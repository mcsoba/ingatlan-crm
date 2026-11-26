import {
  addMonths,
  computeGross,
  payableAmount,
  previewOccurrences,
  szjaAmount,
  type InvoiceRow,
  type ScheduleRow,
} from "@/lib/finance";
import type { TaxOccurrence } from "@/lib/finance-tax";

/**
 * Havi költségterv: egy hónap várható bevételei és kiadásai, forrásonként.
 * Csak forintos tételek (az euró ritka, nem keverjük).
 */
export type PlanSource = "invoice" | "planned" | "schedule" | "tax" | "payroll" | "manual" | "overdue";

export const PLAN_SOURCE_LABELS: Record<PlanSource, string> = {
  invoice: "Kiállított, nincs fizetve",
  planned: "Tervezett tétel",
  schedule: "Számla-törzsből (még nincs legyártva)",
  tax: "Adónaptár",
  payroll: "Bérek (becslés)",
  manual: "Kézi tétel",
  overdue: "Korábbról elmaradt",
};

export type PlanLine = {
  key: string;
  source: PlanSource;
  kind: "income" | "expense";
  date: string;
  title: string;
  detail: string;
  amount: number | null;
  href?: string;
  manualId?: string;
};

export type PlanInvoice = Pick<
  InvoiceRow,
  "id" | "direction" | "is_planned" | "category" | "counterparty_name" | "description" | "invoice_number" | "issue_date" | "due_date" | "gross_amount" | "szja_withheld" | "currency" | "paid_amount"
> & { payroll_kind: string | null; period_start: string | null };

export type PlanManual = { id: string; kind: "income" | "expense"; description: string; counterparty: string | null; amount: number; expected_date: string | null; note: string | null };

export type PayrollRef = { period_start: string; gross_amount: number; payroll_kind: string };

const monthEnd = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
};

export function buildPlan(input: {
  month: string;
  unpaid: PlanInvoice[];
  paidSoFar: Map<string, number>;
  schedules: ScheduleRow[];
  taxes: TaxOccurrence[];
  payroll: PayrollRef[];
  manual: PlanManual[];
}): { lines: PlanLine[]; overdue: PlanLine[]; payrollBasis: string | null } {
  const { month } = input;
  const start = `${month}-01`;
  const end = monthEnd(month);
  const lines: PlanLine[] = [];
  const overdue: PlanLine[] = [];

  for (const inv of input.unpaid) {
    if (inv.currency !== "HUF") continue;
    const date = inv.due_date ?? inv.issue_date;
    const remaining = payableAmount(inv) - (input.paidSoFar.get(inv.id) ?? 0);
    if (Math.abs(remaining) < 1) continue;
    const line: PlanLine = {
      key: inv.id,
      source: inv.is_planned ? "planned" : "invoice",
      kind: inv.direction === "out" ? "income" : "expense",
      date,
      title: inv.counterparty_name,
      detail: [inv.description, inv.invoice_number].filter(Boolean).join(" · "),
      amount: remaining,
      href: `/dashboard/finance/invoices/${inv.id}`,
    };
    if (date < start) overdue.push({ ...line, source: "overdue" });
    else if (date <= end) lines.push(line);
  }

  // Törzsek: a még le nem gyártott esedékességek, amelyek fizetési határideje erre a hónapra esik
  for (const s of input.schedules) {
    if (!s.active || s.currency !== "HUF") continue;
    for (const occ of previewOccurrences(s, s.next_period_start, 24)) {
      if (occ.dueDate > end) break;
      if (occ.dueDate < start) continue;
      const vat = s.vat_rate === null ? null : Number(s.vat_rate);
      const { gross } = computeGross(occ.net, vat, s.currency);
      const amount = s.szja_withheld ? gross - szjaAmount(gross, s.currency) : gross;
      lines.push({
        key: `s-${s.id}-${occ.periodStart}`,
        source: "schedule",
        kind: s.direction === "out" ? "income" : "expense",
        date: occ.dueDate,
        title: s.counterparty_name,
        detail: [s.description, s.location, s.szja_withheld ? "SZJA levonva" : ""].filter(Boolean).join(" · "),
        amount,
        href: `/dashboard/finance/schedules/${s.id}`,
      });
    }
  }

  // Bérek: a tárgyhót követő hónapban fizetjük. Ha az előző hónapra még nincs rögzítve, becslés —
  // a bérek és az adók külön-külön a legutóbbi olyan hónapból, ahol szerepelnek.
  let payrollBasis: string | null = null;
  let payrollTaxEstimated = false;
  const prev = addMonths(start, -1);
  const estimate = (isWage: boolean) => {
    const rows = input.payroll.filter((p) => (p.payroll_kind === "wage") === isWage);
    if (rows.some((p) => p.period_start === prev)) return null; // van valódi adat
    const latest = rows.map((p) => p.period_start).sort().at(-1);
    if (!latest || latest > prev) return null;
    return { period: latest.slice(0, 7), amount: rows.filter((p) => p.period_start === latest).reduce((s, p) => s + Number(p.gross_amount), 0) };
  };
  const wageEst = estimate(true);
  const taxEst = estimate(false);
  if (wageEst?.amount) {
    payrollBasis = wageEst.period;
    lines.push({ key: "payroll-wage", source: "payroll", kind: "expense", date: `${month}-10`, title: "Munkabérek", detail: `becslés a ${wageEst.period} havi bérek alapján`, amount: wageEst.amount });
  }
  if (taxEst?.amount) {
    payrollTaxEstimated = true;
    payrollBasis ??= taxEst.period;
    lines.push({ key: "payroll-tax", source: "payroll", kind: "expense", date: `${month}-12`, title: "Bérek utáni adók és járulékok", detail: `becslés a ${taxEst.period} havi adók alapján`, amount: taxEst.amount });
  }
  const payrollTaxKnown = payrollTaxEstimated || input.payroll.some((p) => p.payroll_kind !== "wage" && p.period_start === prev);

  // Adónaptár: a bérek utáni adókat a bér-blokk tartalmazza (ha van rá adat vagy becslés)
  for (const t of input.taxes) {
    if (t.task?.done_at || t.due < start || t.due > end) continue;
    if (/^Bérek utáni/i.test(t.obligation.name) && payrollTaxKnown) continue;
    lines.push({
      key: `t-${t.obligation.id}-${t.nominal}`,
      source: "tax",
      kind: "expense",
      date: t.due,
      title: t.obligation.name + (t.obligation.municipality ? ` · ${t.obligation.municipality}` : ""),
      detail: t.obligation.amount ? "a szokásos összeggel" : "összeg nincs megadva az adónaptárban",
      amount: t.obligation.amount ? Number(t.obligation.amount) : null,
      href: `/dashboard/finance/taxes?company=${t.obligation.company_id}`,
    });
  }

  for (const m of input.manual) {
    lines.push({
      key: `m-${m.id}`,
      source: "manual",
      kind: m.kind,
      date: m.expected_date ?? start,
      title: m.description,
      detail: [m.counterparty, m.note].filter(Boolean).join(" · "),
      amount: Number(m.amount),
      manualId: m.id,
    });
  }

  lines.sort((a, b) => a.date.localeCompare(b.date));
  overdue.sort((a, b) => a.date.localeCompare(b.date));
  return { lines, overdue, payrollBasis };
}

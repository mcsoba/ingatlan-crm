import Link from "next/link";
import { Building, Check, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { savePayrollMonth } from "../payroll-actions";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import {
  COMPANY_PERSON_ROLE_LABELS,
  PAYROLL_SELECT,
  PAYROLL_TAX_KINDS,
  addMonths,
  daysInMonth,
  formatDate,
  formatMoney,
  payrollDueDate,
  szjaAmount,
  todayIso,
  type CompanyPersonRole,
  type PayrollKind,
  type PayrollRow,
} from "@/lib/finance";

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

type Line = {
  key: string;
  kind: PayrollKind;
  title: string;
  subtitle: string | null;
  current: PayrollRow | undefined;
  previous: PayrollRow | undefined;
};

function keyOf(r: Pick<PayrollRow, "payroll_kind" | "person_id">) {
  return r.payroll_kind === "wage" ? `wage:${r.person_id}` : `tax:${r.payroll_kind}`;
}

function sum(rows: { gross_amount: number }[]) {
  return rows.reduce((s, r) => s + Number(r.gross_amount), 0);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string; saved?: string; prefill?: string }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prevMonth = addMonths(`${month}-01`, -1).slice(0, 7);
  const nextMonth = addMonths(`${month}-01`, 1).slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
  // Az év + az előző hónap (januárnál a tavalyi december az „előző hó” összegekhez)
  const fromDate = `${prevMonth < `${y}-01` ? prevMonth : `${y}-01`}-01`;

  // A bérlista mindig egy céghez tartozik: URL → oldalsáv → első cég
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  const link = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ company: companyId ?? "", month, ...patch });
    return `/dashboard/finance/payroll?${params}`;
  };

  if (!companyId) {
    return <EmptyState icon={Building} title="Még nincs cég felvéve" description="A bérlista cégenként készül — előbb vedd fel a cégeket a Cégek fülön." />;
  }

  const supabase = await createClient();
  const { data: yearRows, error } = await supabase
    .from("finance_invoices")
    .select(PAYROLL_SELECT)
    .eq("company_id", companyId)
    .not("payroll_kind", "is", null)
    .gte("period_start", fromDate)
    .lte("period_start", `${y}-12-31`);
  if (isMissingTable(error)) return <MigrationNotice file="0047_finance_payroll.sql" />;
  if (error) throw error;
  const payroll = (yearRows ?? []) as PayrollRow[];

  const [{ data: peopleRows }, { data: szjaRows }, { data: lodgingRows }] = await Promise.all([
    supabase.from("finance_company_people").select("id, name, role, position, start_date, end_date").eq("company_id", companyId).order("name"),
    supabase
      .from("finance_invoices")
      .select("id, lodging_id, location, counterparty_name, period_start, issue_date, gross_amount, currency, paid_date")
      .eq("company_id", companyId)
      .eq("szja_withheld", true)
      .gte("issue_date", `${y - 1}-12-01`)
      .lte("issue_date", `${y + 1}-01-31`),
    supabase.from("finance_lodgings").select("id, address").eq("company_id", companyId),
  ]);

  const thisMonth = payroll.filter((r) => r.period_start === monthStart);
  const lastMonth = payroll.filter((r) => r.period_start === `${prevMonth}-01`);
  const currentByKey = new Map(thisMonth.map((r) => [keyOf(r), r]));
  const previousByKey = new Map(lastMonth.map((r) => [keyOf(r), r]));

  // Aki a hónapban a cégnél dolgozott (könyvelő / egyéb kimarad), plusz akinek már van bére erre a hónapra
  const people = (peopleRows ?? []).filter(
    (p) =>
      currentByKey.has(`wage:${p.id}`) ||
      (p.role !== "accountant" && p.role !== "other" && (!p.start_date || p.start_date <= monthEnd) && (!p.end_date || p.end_date >= monthStart)),
  );

  const wageLines: Line[] = people.map((p) => ({
    key: `wage:${p.id}`,
    kind: "wage",
    title: p.name,
    subtitle: p.position || COMPANY_PERSON_ROLE_LABELS[p.role as CompanyPersonRole],
    current: currentByKey.get(`wage:${p.id}`),
    previous: previousByKey.get(`wage:${p.id}`),
  }));
  const taxLines: Line[] = PAYROLL_TAX_KINDS.map((t) => ({
    key: `tax:${t.kind}`,
    kind: t.kind,
    title: t.label,
    subtitle: t.hint,
    current: currentByKey.get(`tax:${t.kind}`),
    previous: previousByKey.get(`tax:${t.kind}`),
  }));
  const hasPrevious = lastMonth.length > 0;
  const prefill = sp.prefill === "1";

  // Bérleti díjakból levont SZJA (magánszemély bérbeadók) — ezt is a NAV-nak kell befizetni
  const lodgingAddress = new Map((lodgingRows ?? []).map((l) => [l.id as string, l.address as string]));
  const szjaItems = (szjaRows ?? []).map((r) => ({
    ...r,
    month: (r.period_start ?? r.issue_date).slice(0, 7) as string,
    place: (r.lodging_id && lodgingAddress.get(r.lodging_id)) || r.location || r.counterparty_name,
    szja: szjaAmount(Number(r.gross_amount), r.currency),
  }));
  const szjaThisMonth = szjaItems.filter((r) => r.month === month).sort((a, b) => a.place.localeCompare(b.place, "hu"));
  const rentSzjaTotal = szjaThisMonth.reduce((s, r) => s + r.szja, 0);

  const wagesTotal = sum(thisMonth.filter((r) => r.payroll_kind === "wage"));
  const taxTotal = sum(thisMonth.filter((r) => r.payroll_kind !== "wage"));
  const unpaid = thisMonth.filter((r) => !r.paid_date);

  const yearSummary = MONTH_NAMES.map((name, i) => {
    const key = `${y}-${String(i + 1).padStart(2, "0")}`;
    const rows = payroll.filter((r) => r.period_start?.startsWith(key));
    return {
      key,
      name,
      wages: sum(rows.filter((r) => r.payroll_kind === "wage")),
      taxes: sum(rows.filter((r) => r.payroll_kind !== "wage")),
      rentSzja: szjaItems.filter((r) => r.month === key).reduce((s, r) => s + r.szja, 0),
      unpaid: rows.filter((r) => !r.paid_date).length,
    };
  });

  function row(line: Line) {
    const cur = line.current;
    const prevAmount = line.previous ? Number(line.previous.gross_amount) : null;
    const defaultAmount = cur ? String(Number(cur.gross_amount)) : prefill && prevAmount ? String(prevAmount) : "";
    const overdue = cur && !cur.paid_date && cur.due_date && cur.due_date < today;
    return (
      <tr key={line.key} className="border-b border-border-subtle last:border-0 align-top">
        <td className="px-4 py-2">
          <input type="hidden" name="keys" value={line.key} />
          <div className="font-medium text-foreground">{line.title}</div>
          {line.subtitle && <div className="text-xs text-muted">{line.subtitle}</div>}
          {line.kind === "szja" && rentSzjaTotal > 0 && (
            <div className="text-xs text-accent">ebből bérleti díjakból levont: {formatMoney(rentSzjaTotal)}</div>
          )}
        </td>
        <td className="px-2 py-2">
          <input
            name={`amount__${line.key}`}
            inputMode="numeric"
            defaultValue={defaultAmount}
            placeholder="0"
            className={`${inputClass} w-36 text-right tabular-nums ${!cur && defaultAmount ? "border-warning/60" : ""}`}
          />
          {prevAmount !== null && <div className="mt-0.5 text-xs text-muted">előző hó: {formatMoney(prevAmount)}</div>}
        </td>
        <td className="px-2 py-2">
          <input type="date" name={`due__${line.key}`} defaultValue={cur?.due_date ?? payrollDueDate(line.kind, month)} className={`${inputClass} w-40`} />
        </td>
        <td className="px-2 py-2">
          <input type="date" name={`paid__${line.key}`} defaultValue={cur?.paid_date ?? ""} className={`${inputClass} w-40`} />
        </td>
        <td className="px-4 py-2">
          {!cur ? (
            <span className="text-xs text-muted">{defaultAmount ? "mentésre vár" : "—"}</span>
          ) : cur.paid_date ? (
            <Badge variant="success">Kifizetve</Badge>
          ) : overdue ? (
            <Badge variant="danger">Lejárt</Badge>
          ) : (
            <Badge variant="warning">Fizetendő</Badge>
          )}
        </td>
      </tr>
    );
  }

  const tableHead = (first: string) => (
    <thead>
      <tr className="border-b border-border text-left text-xs text-muted">
        <th className="px-4 py-2 font-medium">{first}</th>
        <th className="px-2 py-2 font-medium">Összeg (Ft)</th>
        <th className="px-2 py-2 font-medium">Fizetési határidő</th>
        <th className="px-2 py-2 font-medium">Kifizetve (dátum)</th>
        <th className="px-4 py-2 font-medium">Állapot</th>
      </tr>
    </thead>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Bér és adók"
        description="Havi bérlista cégenként: munkabér munkatársanként, alatta a cég adói és járulékai (EFO, cégautó adó, SZJA, szocho, TB). Minden sor pénzügyi tétel lesz — megjelenik az áttekintésben és a havi pénzmozgásban."
      />

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex items-center gap-2">
          <input type="hidden" name="month" value={month} />
          <select name="company" defaultValue={companyId} className={`${inputClass} w-auto py-1.5`}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonVariants("secondary", "sm")}>
            Mutasd
          </button>
        </form>
        <div className="flex items-center gap-1">
          <Link href={link({ month: prevMonth })} className={buttonVariants("ghost", "sm")} aria-label="Előző hónap">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold">
            {y}. {MONTH_NAMES[m - 1]}
          </span>
          <Link href={link({ month: nextMonth })} className={buttonVariants("ghost", "sm")} aria-label="Következő hónap">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {sp.saved && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-sm text-success">
          <Check className="h-4 w-4" />
          Bérlista mentve
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted">Munkabérek</div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(wagesTotal)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Adók, járulékok</div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(taxTotal)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Összesen</div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(wagesTotal + taxTotal)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Még nincs kifizetve</div>
          <div className={`text-lg font-semibold tabular-nums ${unpaid.length ? "text-danger" : "text-success"}`}>
            {unpaid.length ? `${unpaid.length} tétel · ${formatMoney(sum(unpaid))}` : thisMonth.length ? "minden rendezve" : "—"}
          </div>
        </Card>
      </div>

      {hasPrevious && thisMonth.length === 0 && !prefill && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/40 p-4 text-sm">
          <span>Ebben a hónapban még nincs semmi rögzítve. Átveszed az előző havi összegeket? (Mentés előtt átírhatod őket.)</span>
          <Link href={link({ prefill: "1" })} className={buttonVariants("secondary", "sm")}>
            Előző hónap összegeinek átvétele
          </Link>
        </Card>
      )}
      {prefill && thisMonth.length === 0 && (
        <p className="text-sm text-warning">Az előző havi összegek beírva (sárga keret) — nézd át, majd mentsd el.</p>
      )}

      <form action={savePayrollMonth} className="flex flex-col gap-4">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="month" value={month} />

        <Card className="overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Munkabérek</h2>
            <Link href={`/dashboard/finance/companies/${companyId}#szemelyek`} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              <UserPlus className="h-3.5 w-3.5" />
              Munkatárs felvétele / kilépés a cég adatlapján
            </Link>
          </div>
          {wageLines.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">
              Ennél a cégnél még nincs munkatárs felvéve. A cég adatlapján add hozzá őket (Cégek → a cég → „Személy hozzáadása”), és itt megjelennek.
            </p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              {tableHead("Munkatárs")}
              <tbody>{wageLines.map(row)}</tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Adók és járulékok (NAV)</div>
          <table className="w-full min-w-[820px] text-sm">
            {tableHead("Megnevezés")}
            <tbody>{taxLines.map(row)}</tbody>
          </table>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs text-muted">Üresen hagyott összeg = nincs ilyen tétel (a korábban mentett törlődik).</span>
          <Button type="submit">Bérlista mentése</Button>
        </div>
      </form>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Bérleti díjakból levont SZJA — szállásonként</h2>
          <p className="text-xs text-muted">
            Magánszemély bérbeadóknál a bérleti díj 90%-a után 15% SZJA-t mi vonunk le és fizetünk be. A tételekből automatikusan számolva — a fenti SZJA-sorba ezt is bele kell számolni.
          </p>
        </div>
        {szjaThisMonth.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Erre a hónapra nincs SZJA-levonásos bérleti díj ennél a cégnél.</p>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Szállás / bérbeadó</th>
                <th className="px-2 py-2 text-right font-medium">Bérleti díj (bruttó)</th>
                <th className="px-2 py-2 text-right font-medium">Levont SZJA</th>
                <th className="px-4 py-2 font-medium">Bérbeadónak kifizetve</th>
              </tr>
            </thead>
            <tbody>
              {szjaThisMonth.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/finance/invoices/${r.id}`} className="text-foreground hover:underline">
                      {r.place}
                    </Link>
                    {r.place !== r.counterparty_name && <div className="text-xs text-muted">{r.counterparty_name}</div>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatMoney(Number(r.gross_amount), r.currency)}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{formatMoney(r.szja, r.currency)}</td>
                  <td className="px-4 py-2 text-xs">{r.paid_date ? formatDate(r.paid_date) : <span className="text-warning">még nem</span>}</td>
                </tr>
              ))}
              <tr className="bg-background/60 font-semibold">
                <td className="px-4 py-2">Összesen</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatMoney(szjaThisMonth.reduce((s, r) => s + Number(r.gross_amount), 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatMoney(rentSzjaTotal)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">{y}. évi összesítő</div>
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">Hónap</th>
              <th className="px-2 py-2 text-right font-medium">Munkabérek</th>
              <th className="px-2 py-2 text-right font-medium">Adók, járulékok</th>
              <th className="px-2 py-2 text-right font-medium">Bérleti díjakból levont SZJA</th>
              <th className="px-4 py-2 text-right font-medium">Nyitott</th>
            </tr>
          </thead>
          <tbody>
            {yearSummary.map((s) => (
              <tr key={s.key} className={`border-b border-border-subtle last:border-0 ${s.key === month ? "bg-accent-soft/40" : ""}`}>
                <td className="px-4 py-1.5">
                  <Link href={link({ month: s.key })} className="hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.wages ? formatMoney(s.wages) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.taxes ? formatMoney(s.taxes) : "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{s.rentSzja ? formatMoney(s.rentSzja) : "—"}</td>
                <td className="px-4 py-1.5 text-right">{s.unpaid ? <Badge variant="warning">{s.unpaid}</Badge> : ""}</td>
              </tr>
            ))}
            <tr className="bg-background/60 font-semibold">
              <td className="px-4 py-2">Összesen</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(yearSummary.reduce((s, r) => s + r.wages, 0))}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(yearSummary.reduce((s, r) => s + r.taxes, 0))}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatMoney(yearSummary.reduce((s, r) => s + r.rentSzja, 0))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

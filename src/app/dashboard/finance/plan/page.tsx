import Link from "next/link";
import { Building, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { loadInvoiceExtras } from "@/lib/finance-extras";
import { bankMoves, monthlyFlows, type Checkpoint, type FlowInvoice } from "@/lib/finance-flow";
import { occurrences, type TaxObligation, type TaxTask } from "@/lib/finance-tax";
import { PLAN_SOURCE_LABELS, buildPlan, type PayrollRef, type PlanInvoice, type PlanLine, type PlanManual } from "@/lib/finance-plan";
import { SCHEDULE_SELECT, addMonths, formatDate, formatMoney, todayIso, type ScheduleRow } from "@/lib/finance";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { PlanItemDelete, PlanItemForm } from "./plan-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

function Lines({ title, lines, back, tone }: { title: string; lines: PlanLine[]; back: string; tone: "income" | "expense" }) {
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const unknown = lines.filter((l) => l.amount === null).length;
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`text-sm font-semibold tabular-nums ${tone === "income" ? "text-success" : ""}`}>
          {tone === "income" ? "+" : "−"}
          {formatMoney(total)}
          {unknown > 0 && <span className="ml-1 text-xs font-normal text-warning">(+ {unknown} ismeretlen összeg)</span>}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Nincs ilyen tétel.</p>
      ) : (
        <ul className="divide-y divide-border-subtle text-sm">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3 px-4 py-1.5">
              <span className="w-20 shrink-0 tabular-nums text-muted">{formatDate(l.date).slice(5)}</span>
              <span className="min-w-0 flex-1">
                {l.href ? (
                  <Link href={`${l.href}${l.href.includes("?") ? "&" : "?"}back=${encodeURIComponent(back)}`} className="font-medium hover:underline">
                    {l.title}
                  </Link>
                ) : (
                  <span className="font-medium">{l.title}</span>
                )}
                <span className="block truncate text-xs text-muted">
                  {PLAN_SOURCE_LABELS[l.source]}
                  {l.detail ? ` · ${l.detail}` : ""}
                </span>
              </span>
              <span className="whitespace-nowrap text-right font-medium tabular-nums">{l.amount === null ? <span className="text-warning">?</span> : formatMoney(l.amount)}</span>
              {l.manualId && <PlanItemDelete id={l.manualId} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Havi költségterv: mi várható be és ki egy hónapban, és mennyi pénz marad a számlán. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ company?: string; month?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : addMonths(`${today.slice(0, 7)}-01`, 1).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  if (!companyId) return <EmptyState icon={Building} title="Még nincs cég felvéve" description="Előbb vedd fel a cégeket a Cégek fülön." />;
  const link = (patch: Record<string, string>) => `/dashboard/finance/plan?${new URLSearchParams({ company: companyId, month, ...patch })}`;
  const monthStart = `${month}-01`;
  const isCurrent = month === today.slice(0, 7);

  const supabase = await createClient();
  const [manualRes, unpaidRes, schedRes, obRes, payRes, flowRes, cpRes, extras] = await Promise.all([
    supabase.from("finance_plan_items").select("id, kind, description, counterparty, amount, expected_date, note").eq("company_id", companyId).eq("month", monthStart),
    fetchAll<PlanInvoice>(() =>
      supabase
        .from("finance_invoices")
        .select("id, direction, is_planned, category, counterparty_name, description, invoice_number, issue_date, due_date, gross_amount, szja_withheld, currency, paid_amount, payroll_kind, period_start")
        .eq("company_id", companyId)
        .is("paid_date", null),
    ),
    supabase.from("finance_schedules").select(SCHEDULE_SELECT).eq("company_id", companyId).eq("active", true),
    supabase.from("finance_tax_obligations").select("id, company_id, name, schedule, municipality, amount, notes, active, sort_order, created_at").eq("company_id", companyId),
    supabase.from("finance_invoices").select("period_start, gross_amount, payroll_kind").eq("company_id", companyId).not("payroll_kind", "is", null).gte("period_start", addMonths(monthStart, -6)),
    fetchAll<FlowInvoice>(() =>
      supabase
        .from("finance_invoices")
        .select("id, direction, category, payment_method, paid_date, bank_booked_date, gross_amount, paid_amount, szja_withheld, currency, counterparty_name")
        .eq("company_id", companyId)
        .not("paid_date", "is", null),
    ),
    supabase.from("finance_bank_balances").select("id, balance_date, balance, note").eq("company_id", companyId),
    loadInvoiceExtras(supabase),
  ]);
  if (isMissingTable(manualRes.error)) return <MigrationNotice file="0053_finance_plan_items.sql" />;
  if (manualRes.error) throw manualRes.error;
  if (unpaidRes.error) throw unpaidRes.error;

  const obligations = (obRes.data ?? []) as TaxObligation[];
  const { data: taskRows } = obligations.length
    ? await supabase.from("finance_tax_tasks").select("id, obligation_id, due_date, done_at, amount, note").in("obligation_id", obligations.map((o) => o.id))
    : { data: [] };
  const taxes = occurrences(obligations, (taskRows ?? []) as TaxTask[], monthStart, `${month}-31`);

  const { lines, overdue, payrollBasis } = buildPlan({
    month,
    unpaid: unpaidRes.data.filter((i) => !extras.cancelled.has(i.id)),
    paidSoFar: extras.paidSoFar,
    schedules: (schedRes.data ?? []) as ScheduleRow[],
    taxes,
    payroll: (payRes.data ?? []) as PayrollRef[],
    manual: (manualRes.data ?? []) as PlanManual[],
  });
  const income = lines.filter((l) => l.kind === "income");
  const expense = lines.filter((l) => l.kind === "expense");
  const sum = (ls: PlanLine[]) => ls.reduce((s, l) => s + (l.amount ?? 0), 0);

  // Nyitó egyenleg: a Havi pénzmozgás szerinti záró az előző hónap végén; a folyó hónapban a már megtörtént mozgás is számít
  const moves = flowRes.error ? [] : bankMoves(flowRes.data, extras.cancelled);
  const checkpoints = (cpRes.data ?? []) as Checkpoint[];
  const prevMonth = addMonths(monthStart, -1).slice(0, 7);
  const [prevFlow, thisFlow] = monthlyFlows(moves, checkpoints, [prevMonth, month]);
  const opening = prevFlow.closing;
  const doneNet = isCurrent ? thisFlow.income - thisFlow.expense : 0;
  const closing = opening + doneNet + sum(income) - sum(expense);
  const overdueIncome = overdue.filter((l) => l.kind === "income");
  const overdueExpense = overdue.filter((l) => l.kind === "expense");
  const back = link({});

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Havi terv"
        description="Mi várható be és ki a hónapban: a még nem fizetett számlák, a számla-törzsekből jövő díjak, az adónaptár, a bérek becslése és a kézi tételek. A nyitó egyenleg a Havi pénzmozgásból jön."
      />

      {companies.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/finance/plan?company=${c.id}&month=${month}`} className={buttonVariants(c.id === companyId ? "primary" : "secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link href={link({ month: addMonths(monthStart, -1).slice(0, 7) })} className={buttonVariants("secondary", "sm")} aria-label="Előző hónap">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
        <span className="min-w-36 text-center text-sm font-semibold">
          {y}. {MONTHS[m - 1]}
        </span>
        <Link href={link({ month: addMonths(monthStart, 1).slice(0, 7) })} className={buttonVariants("secondary", "sm")} aria-label="Következő hónap">
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        {isCurrent && <Badge variant="accent">folyó hónap</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Nyitó egyenleg", opening, "az előző hónap számított záró egyenlege"],
          ...(isCurrent ? ([["Már megtörtént", doneNet, "e hónap eddigi bankmozgása"]] as const) : []),
          ["Várható bevétel", sum(income), `${income.length} tétel`],
          ["Várható kiadás", -sum(expense), `${expense.length} tétel`],
          ["Várható záró", closing, "ha minden a terv szerint alakul"],
        ].map(([label, value, sub]) => (
          <Card key={label as string} className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted">{label}</span>
            <span className={`text-xl font-semibold tabular-nums ${(value as number) < 0 ? "text-danger" : label === "Várható bevétel" ? "text-success" : ""}`}>{formatMoney(value as number)}</span>
            <span className="text-[11px] text-muted">{sub}</span>
          </Card>
        ))}
      </div>
      {payrollBasis && (
        <p className="-mt-2 text-xs text-muted">
          A bérek becslés a {payrollBasis} havi bérlista alapján, mert az előző hónapra még nincs bér rögzítve. Ha rögzíted a Bér és adók fülön, a becslés helyett a valódi összeg számít.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Lines title="Várható bevételek" lines={income} back={back} tone="income" />
        <Lines title="Várható kiadások" lines={expense} back={back} tone="expense" />
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold">Kézi tétel a hónapra</h2>
        <p className="text-xs text-muted">Amihez még nincs számla vagy törzs — pl. egy új szállás kauciója, egyszeri beszerzés, várt jutalék.</p>
        <PlanItemForm companyId={companyId} month={month} />
      </Card>

      {overdue.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground">
            Korábbról elmaradt, még nyitott tételek: +{formatMoney(sum(overdueIncome))} várható bevétel, −{formatMoney(sum(overdueExpense))} kiadás ({overdue.length} db) — a fenti tervben nincsenek benne
          </summary>
          <div className="mt-2 grid gap-4 lg:grid-cols-2">
            <Lines title="Elmaradt bevételek (kintlévőség)" lines={overdueIncome} back={back} tone="income" />
            <Lines title="Elmaradt kiadások" lines={overdueExpense} back={back} tone="expense" />
          </div>
        </details>
      )}
    </div>
  );
}

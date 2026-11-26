import Link from "next/link";
import { Building, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { occurrences, scheduleLabel, type TaxObligation, type TaxOccurrence, type TaxTask } from "@/lib/finance-tax";
import { addDays, formatDate, formatMoney, todayIso } from "@/lib/finance";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { DoneButton, LoadDefaultsButton, ObligationForm } from "./tax-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

function OccurrenceRow({ occ, today }: { occ: TaxOccurrence; today: string }) {
  const done = Boolean(occ.task?.done_at);
  const days = Math.round((new Date(occ.due).getTime() - new Date(today).getTime()) / 864e5);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <span className={`w-24 shrink-0 tabular-nums ${done ? "text-muted line-through" : days < 0 ? "font-semibold text-danger" : days <= 7 ? "font-semibold text-warning" : ""}`}>{formatDate(occ.due)}</span>
      <span className="min-w-0 flex-1">
        <span className={done ? "text-muted" : "font-medium"}>{occ.obligation.name}</span>
        {occ.obligation.municipality && <span className="text-muted"> · {occ.obligation.municipality}</span>}
        <span className="block text-xs text-muted">
          {[
            occ.periodLabel && `${occ.periodLabel} után`,
            occ.due !== occ.nominal && `határidő ${formatDate(occ.nominal)} (hétvége → munkanap)`,
            occ.obligation.amount && `szokásosan ${formatMoney(Number(occ.obligation.amount))}`,
            done && `kész ${formatDate(occ.task!.done_at)}${occ.task!.amount ? ` · ${formatMoney(Number(occ.task!.amount))}` : ""}${occ.task!.note ? ` · ${occ.task!.note}` : ""}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {!done && days < 0 && <Badge variant="danger">{-days} napja lejárt</Badge>}
      {!done && days >= 0 && days <= 7 && <Badge variant="warning">{days === 0 ? "ma" : `${days} nap múlva`}</Badge>}
      <DoneButton obligationId={occ.obligation.id} nominal={occ.nominal} done={done} defaultAmount={occ.obligation.amount} />
    </li>
  );
}

/** Adónaptár: bevallási / befizetési határidők cégenként, „Kész” jelöléssel. */
export default async function TaxesPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  if (!companyId) return <EmptyState icon={Building} title="Még nincs cég felvéve" description="Előbb vedd fel a cégeket a Cégek fülön." />;

  const supabase = await createClient();
  const { data: obRows, error } = await supabase
    .from("finance_tax_obligations")
    .select("id, company_id, name, schedule, municipality, amount, notes, active, sort_order, created_at")
    .eq("company_id", companyId)
    .order("sort_order")
    .order("name");
  if (isMissingTable(error)) return <MigrationNotice file="0052_finance_tax_calendar.sql" />;
  if (error) throw error;
  const obligations = (obRows ?? []) as TaxObligation[];
  const { data: taskRows } = obligations.length
    ? await supabase.from("finance_tax_tasks").select("id, obligation_id, due_date, done_at, amount, note").in("obligation_id", obligations.map((o) => o.id))
    : { data: [] };
  const tasks = (taskRows ?? []) as TaxTask[];

  const all = occurrences(obligations, tasks, addDays(today, -365), addDays(today, 120));
  const overdue = all.filter((o) => !o.task?.done_at && o.due < today);
  const upcoming = all.filter((o) => o.due >= today);
  const recentDone = all.filter((o) => o.task?.done_at && o.due < today).slice(-8).reverse();
  const byMonth = new Map<string, TaxOccurrence[]>();
  for (const o of upcoming) byMonth.set(o.due.slice(0, 7), [...(byMonth.get(o.due.slice(0, 7)) ?? []), o]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Adónaptár"
        description="Bevallási és befizetési határidők cégenként. A „Kész” gombbal jelöld, ha bevallottátok / befizettétek. A hétvégére eső határidő a következő munkanapra tolódik (az ünnepnapokat a rendszer nem ismeri)."
      />

      {companies.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/finance/taxes?company=${c.id}`} className={buttonVariants(c.id === companyId ? "primary" : "secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {obligations.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <CalendarClock className="h-5 w-5 text-accent" />
            Még nincs adónaptár ennél a cégnél
          </div>
          <p className="text-sm text-muted">
            Betöltöm egy Kft. szokásos kötelezettségeit (bérek utáni adók és járulékok, ÁFA, társasági adó és előleg, iparűzési adó és előleg, cégautóadó, gépjárműadó, éves beszámoló) az általános határidőkkel. Utána szerkesztheted: amelyik nem vonatkozik rátok, kapcsold ki; a gyakoriságot (pl. havi vagy negyedéves ÁFA) egyeztesd a könyvelővel.
          </p>
          <LoadDefaultsButton companyId={companyId} />
        </Card>
      ) : (
        <>
          {overdue.length > 0 && (
            <Card className="overflow-hidden border-danger/40 p-0">
              <div className="border-b border-border bg-danger-soft px-4 py-2 text-sm font-semibold text-danger">Lejárt, nincs „Kész”-nek jelölve ({overdue.length})</div>
              <ul className="divide-y divide-border-subtle text-sm">
                {overdue.map((o) => (
                  <OccurrenceRow key={`${o.obligation.id}|${o.nominal}`} occ={o} today={today} />
                ))}
              </ul>
            </Card>
          )}

          {[...byMonth.entries()].map(([month, list]) => {
            const [y, m] = month.split("-").map(Number);
            return (
              <Card key={month} className="overflow-hidden p-0">
                <div className="border-b border-border px-4 py-2 text-sm font-semibold">
                  {y}. {MONTHS[m - 1]}
                </div>
                <ul className="divide-y divide-border-subtle text-sm">
                  {list.map((o) => (
                    <OccurrenceRow key={`${o.obligation.id}|${o.nominal}`} occ={o} today={today} />
                  ))}
                </ul>
              </Card>
            );
          })}

          {recentDone.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted hover:text-foreground">Legutóbb teljesítve ({recentDone.length})</summary>
              <Card className="mt-2 overflow-hidden p-0">
                <ul className="divide-y divide-border-subtle">
                  {recentDone.map((o) => (
                    <OccurrenceRow key={`${o.obligation.id}|${o.nominal}`} occ={o} today={today} />
                  ))}
                </ul>
              </Card>
            </details>
          )}

          <Card className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Kötelezettségek</h2>
              <ObligationForm companyId={companyId} />
            </div>
            <ul className="divide-y divide-border-subtle text-sm">
              {obligations.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 flex-1">
                    <span className={o.active ? "font-medium" : "text-muted line-through"}>{o.name}</span>
                    {o.municipality && <span className="text-muted"> · {o.municipality}</span>}
                    <span className="block text-xs text-muted">
                      {scheduleLabel(o.schedule)}
                      {o.amount ? ` · szokásosan ${formatMoney(Number(o.amount))}` : ""}
                      {!o.active ? " · kikapcsolva" : ""}
                    </span>
                    {o.notes && <span className="block text-xs text-muted-subtle">{o.notes}</span>}
                  </span>
                  <ObligationForm companyId={companyId} obligation={o} />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

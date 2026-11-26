import Link from "next/link";
import { Building, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { CASH_INVOICE_SELECT, CASH_KIND_LABELS, cashBalances, cashEffect, type CashInvoice, type CashTransfer } from "@/lib/finance-cash";
import { addMonths, daysInMonth, formatDate, formatMoney, todayIso } from "@/lib/finance";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { PersonSelect, TransferDelete, TransferForm, UnassignedPanel, type UnassignedRow } from "./cash-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

export const dynamic = "force-dynamic";

/** Pénztár: kinél mennyi készpénz van (kp felvétel, készpénzes kiadás/bevétel, befizetés, átadás). */
export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string; person?: string; um?: string }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  if (!companyId) return <EmptyState icon={Building} title="Még nincs cég felvéve" description="A pénztár cégenként készül — előbb vedd fel a cégeket a Cégek fülön." />;
  const person = sp.person ?? "";
  const unassignedMonth = /^\d{4}-\d{2}$/.test(sp.um ?? "") ? sp.um! : "";
  const link = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ company: companyId, month, person, um: unassignedMonth, ...patch })) if (v) params.set(k, v);
    return `/dashboard/finance/cash?${params}`;
  };

  const supabase = await createClient();
  const [invRes, trRes, { data: peopleRows }] = await Promise.all([
    fetchAll<CashInvoice>(() =>
      supabase.from("finance_invoices").select(CASH_INVOICE_SELECT).eq("company_id", companyId).or("category.eq.cash,payment_method.eq.cash"),
    ),
    supabase.from("finance_cash_transfers").select("id, company_id, transfer_date, amount, currency, from_person_id, to_person_id, note").eq("company_id", companyId).order("transfer_date", { ascending: false }),
    supabase.from("finance_company_people").select("id, name, end_date").eq("company_id", companyId).order("name"),
  ]);
  if (isMissingTable(invRes.error as { code?: string }) || isMissingTable(trRes.error)) return <MigrationNotice file="0049_finance_cash.sql" />;
  if (invRes.error) throw invRes.error;
  if (trRes.error) throw trRes.error;

  const invoices = invRes.data.filter((i) => cashEffect(i));
  const transfers = (trRes.data ?? []) as CashTransfer[];
  const people = (peopleRows ?? []) as { id: string; name: string; end_date: string | null }[];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const balances = cashBalances(invoices, transfers);
  const cards = [...balances.values()].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  const totalOut = cards.reduce((s, b) => s + b.balance, 0);

  // Hozzárendelésre vár: készpénzes tétel kezelő nélkül
  const unassignedAll = invoices.filter((i) => !i.cash_person_id && i.currency === "HUF");
  const unassignedMonths = [...new Set(unassignedAll.map((i) => cashEffect(i)!.date.slice(0, 7)))].sort().reverse();
  const unassignedRows: UnassignedRow[] = unassignedAll
    .filter((i) => !unassignedMonth || cashEffect(i)!.date.startsWith(unassignedMonth))
    .map((i) => {
      const e = cashEffect(i)!;
      return { id: i.id, date: e.date, label: i.description, detail: [i.counterparty_name !== i.description ? i.counterparty_name : "", i.invoice_number ?? ""].filter(Boolean).join(" · "), amount: e.amount, kind: CASH_KIND_LABELS[e.kind] };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 500);
  const unassignedSum = unassignedAll.reduce((s, i) => s + cashEffect(i)!.amount, 0);

  // Mozgások a kiválasztott hónapban (és személynél)
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
  type Move = { key: string; date: string; title: string; kind: string; personId: string | null; amount: number; invoiceId?: string; transferId?: string; otherSide?: string };
  const moves: Move[] = [];
  for (const i of invoices) {
    const e = cashEffect(i)!;
    if (e.date < monthStart || e.date > monthEnd || !i.cash_person_id) continue;
    if (person && i.cash_person_id !== person) continue;
    moves.push({ key: i.id, date: e.date, title: i.description, kind: CASH_KIND_LABELS[e.kind], personId: i.cash_person_id, amount: e.amount, invoiceId: i.id });
  }
  for (const t of transfers) {
    if (t.transfer_date < monthStart || t.transfer_date > monthEnd) continue;
    const label = t.note ? `Átadás — ${t.note}` : "Készpénz átadása";
    if (t.from_person_id && (!person || person === t.from_person_id))
      moves.push({ key: `${t.id}-f`, date: t.transfer_date, title: label, kind: `→ ${t.to_person_id ? nameOf.get(t.to_person_id) : "elszámolva"}`, personId: t.from_person_id, amount: -Number(t.amount), transferId: t.id });
    if (t.to_person_id && (!person || person === t.to_person_id))
      moves.push({ key: `${t.id}-t`, date: t.transfer_date, title: label, kind: `← ${t.from_person_id ? nameOf.get(t.from_person_id) : "máshonnan"}`, personId: t.to_person_id, amount: Number(t.amount), transferId: t.id });
  }
  moves.sort((a, b) => b.date.localeCompare(a.date));
  const monthNet = moves.reduce((s, mv) => s + mv.amount, 0);
  const prev = addMonths(monthStart, -1).slice(0, 7);
  const next = addMonths(monthStart, 1).slice(0, 7);
  const activePeople = people.filter((p) => !p.end_date || p.end_date >= today || balances.has(p.id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pénztár"
        description="Kinél mennyi készpénz van: a felvett, kapott és átvett pénzből levonva, amit blokkal elköltött, befizetett a bankba vagy továbbadott."
      />

      {companies.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/finance/cash?company=${c.id}`} className={buttonVariants(c.id === companyId ? "primary" : "secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex flex-col gap-1 p-4">
            <span className="text-xs text-muted">Összesen kint (készpénzben)</span>
            <span className={`text-xl font-semibold tabular-nums ${totalOut < 0 ? "text-danger" : ""}`}>{formatMoney(totalOut)}</span>
            {person && (
              <Link href={link({ person: "" })} className="text-xs text-accent hover:underline">
                Mindenki mozgásai
              </Link>
            )}
          </Card>
          {cards.map((b) => (
            <Link key={b.personId} href={link({ person: b.personId === person ? "" : b.personId })}>
              <Card className={`flex h-full flex-col gap-1 p-4 transition-colors hover:border-accent/40 ${b.personId === person ? "border-accent" : ""}`}>
                <span className="text-xs text-muted">{nameOf.get(b.personId) ?? "?"}</span>
                <span className={`text-xl font-semibold tabular-nums ${b.balance < 0 ? "text-danger" : ""}`}>{formatMoney(b.balance)}</span>
                <span className="text-[11px] leading-snug text-muted">
                  {[
                    b.withdrawn && `felvett ${formatMoney(b.withdrawn)}`,
                    b.received && `kapott ${formatMoney(b.received)}`,
                    b.transferredIn && `átvett ${formatMoney(b.transferredIn)}`,
                    b.spent && `költött ${formatMoney(b.spent)}`,
                    b.deposited && `befizetett ${formatMoney(b.deposited)}`,
                    b.transferredOut && `átadott ${formatMoney(b.transferredOut)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {b.balance < 0 && <span className="text-[11px] text-danger">Többet költött, mint amennyi nála volt — hiányzik egy felvétel vagy átadás?</span>}
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-4 text-sm text-muted">
          Még senkihez nincs készpénz rendelve. Lent jelöld ki a tételeket (pl. egy hónap kp-felvételeit), és add meg, kinél van a pénz.
        </Card>
      )}

      {unassignedAll.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Kinél van? — hozzárendelésre vár</h2>
            <Badge variant="warning">
              {unassignedAll.length} tétel · {formatMoney(unassignedSum)}
            </Badge>
            <span className="flex-1" />
            <div className="flex flex-wrap gap-1 text-xs">
              <Link href={link({ um: "" })} className={`rounded px-2 py-0.5 ${!unassignedMonth ? "bg-accent-soft font-medium text-accent-hover" : "text-muted hover:text-foreground"}`}>
                Mind
              </Link>
              {unassignedMonths.slice(0, 18).map((mo) => (
                <Link key={mo} href={link({ um: mo })} className={`rounded px-2 py-0.5 tabular-nums ${mo === unassignedMonth ? "bg-accent-soft font-medium text-accent-hover" : "text-muted hover:text-foreground"}`}>
                  {mo.replace("-", ".")}
                </Link>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted">
            Kp felvétel: aki felvette. Készpénzes blokk: aki kifizette. Készpénzes bevétel: aki átvette. Kp befizetés: aki befizette a bankba.
          </p>
          {activePeople.length ? (
            <UnassignedPanel rows={unassignedRows} people={activePeople} />
          ) : (
            <p className="text-sm text-muted">Előbb vegyél fel egy pénzkezelőt lent („Új pénzkezelő neve”).</p>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold">Készpénz átadása</h2>
        <TransferForm companyId={companyId} people={activePeople} today={today} />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={link({ month: prev })} className={buttonVariants("secondary", "sm")} aria-label="Előző hónap">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold">
            {y}. {MONTH_NAMES[m - 1]}
          </span>
          <Link href={link({ month: next })} className={buttonVariants("secondary", "sm")} aria-label="Következő hónap">
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          {person && <Badge variant="accent">{nameOf.get(person)}</Badge>}
        </div>
        <span className={`text-sm font-semibold tabular-nums ${monthNet < 0 ? "text-danger" : "text-success"}`}>Havi változás: {monthNet > 0 ? "+" : ""}{formatMoney(monthNet)}</span>
      </div>

      {moves.length === 0 ? (
        <EmptyState icon={Wallet} title="Ebben a hónapban nincs hozzárendelt készpénzmozgás" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Dátum</th>
                <th className="px-2 py-2 font-medium">Mi</th>
                <th className="px-2 py-2 font-medium">Kinél</th>
                <th className="px-4 py-2 text-right font-medium">Összeg</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {moves.map((mv) => (
                <tr key={mv.key} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDate(mv.date)}</td>
                  <td className="px-2 py-2">
                    {mv.invoiceId ? (
                      <Link href={`/dashboard/finance/invoices/${mv.invoiceId}?back=${encodeURIComponent(link({}))}`} className="font-medium hover:underline">
                        {mv.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{mv.title}</span>
                    )}
                    <div className="text-xs text-muted">{mv.kind}</div>
                  </td>
                  <td className="px-2 py-2">
                    {mv.invoiceId ? <PersonSelect invoiceId={mv.invoiceId} value={mv.personId} people={people} /> : <span className="text-xs text-muted">{mv.personId ? nameOf.get(mv.personId) : ""}</span>}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums ${mv.amount < 0 ? "" : "text-success"}`}>
                    {mv.amount > 0 ? "+" : ""}
                    {formatMoney(mv.amount)}
                  </td>
                  <td className="px-2 py-2 text-right">{mv.transferId && <TransferDelete id={mv.transferId} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

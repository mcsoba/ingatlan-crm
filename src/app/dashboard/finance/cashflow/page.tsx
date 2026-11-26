import Link from "next/link";
import { Building, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { loadInvoiceExtras } from "@/lib/finance-extras";
import { bankMoves, monthlyFlows, type Checkpoint, type FlowInvoice } from "@/lib/finance-flow";
import { formatDate, formatMoney, todayIso } from "@/lib/finance";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { BalanceDelete, BalanceForm } from "./flow-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

function Diff({ value }: { value: number }) {
  if (Math.abs(value) < 1) return <span className="text-xs font-medium text-success">✓ egyezik</span>;
  return <span className="text-xs font-medium text-danger">eltérés: {value > 0 ? "+" : ""}{formatMoney(value)}</span>;
}

/** Havi pénzmozgás a bankszámlán: nyitó, bevétel, kiadás, záró — a „Kimutatás” lap helyett. */
export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ company?: string; year?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : Number(today.slice(0, 4));
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  if (!companyId) return <EmptyState icon={Building} title="Még nincs cég felvéve" description="Előbb vedd fel a cégeket a Cégek fülön." />;
  const link = (patch: Record<string, string>) => `/dashboard/finance/cashflow?${new URLSearchParams({ company: companyId, year: String(year), ...patch })}`;

  const supabase = await createClient();
  const [invRes, cpRes, extras] = await Promise.all([
    fetchAll<FlowInvoice>(() =>
      supabase
        .from("finance_invoices")
        .select("id, direction, category, payment_method, paid_date, bank_booked_date, gross_amount, paid_amount, szja_withheld, currency, counterparty_name")
        .eq("company_id", companyId)
        .not("paid_date", "is", null),
    ),
    supabase.from("finance_bank_balances").select("id, balance_date, balance, note").eq("company_id", companyId).order("balance_date"),
    loadInvoiceExtras(supabase),
  ]);
  if (isMissingTable(cpRes.error)) return <MigrationNotice file="0051_finance_bank_balances.sql" />;
  if (invRes.error) throw invRes.error;
  if (cpRes.error) throw cpRes.error;
  const checkpoints = (cpRes.data ?? []) as Checkpoint[];
  const moves = bankMoves(invRes.data, extras.cancelled);
  const lastMonth = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12;
  const months = Array.from({ length: lastMonth }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  // az első bankmozgás (vagy rögzített egyenleg) hónapjától
  const firstMonth = [moves[0]?.date, checkpoints[0]?.balance_date].filter(Boolean).sort()[0]?.slice(0, 7) ?? "9999";
  const flows = monthlyFlows(moves, checkpoints, months).filter((f) => f.month >= firstMonth);
  const firstYear = Number((moves[0]?.date ?? today).slice(0, 4));
  const yearIncome = flows.reduce((s, f) => s + f.income, 0);
  const yearExpense = flows.reduce((s, f) => s + f.expense, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Havi pénzmozgás"
        description="A bankszámla havi mozgása a tételekből: mi jött be, mi ment ki (átutalás, kártya, kp felvétel / befizetés), nyitó és záró egyenleg. A készpénzes blokkok a Pénztárban vannak, a sztornózott tételek kimaradnak."
      />

      {companies.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/finance/cashflow?company=${c.id}&year=${year}`} className={buttonVariants(c.id === companyId ? "primary" : "secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={link({ year: String(year - 1) })} className={buttonVariants("secondary", "sm")} aria-label="Előző év">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="min-w-20 text-center text-sm font-semibold">{year}</span>
          <Link href={link({ year: String(year + 1) })} className={buttonVariants("secondary", "sm")} aria-label="Következő év">
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          {year > firstYear + 1 && <span className="text-xs text-muted">(az első tétel {firstYear}-ből)</span>}
        </div>
        <span className="text-sm tabular-nums text-muted">
          Év összesen: <span className="font-medium text-success">+{formatMoney(yearIncome)}</span> · <span className="font-medium">−{formatMoney(yearExpense)}</span>
        </span>
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-semibold">Tényleges banki egyenleg</h2>
        <p className="text-xs text-muted">
          Írd be egy-egy nap egyenlegét a bankszámlakivonatról (pl. a hónap utolsó napjáét). Innen számol tovább a CRM, és megmutatja, ha a tételekből számolt egyenleg eltér — ott hiányzik vagy duplán van valami.
        </p>
        <BalanceForm companyId={companyId} defaultDate={today} />
        {checkpoints.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs">
            {checkpoints.map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-full border border-border py-0.5 pl-2.5 pr-1">
                <span className="tabular-nums">{formatDate(c.balance_date)}:</span>
                <span className="font-medium tabular-nums">{formatMoney(Number(c.balance))}</span>
                {c.note && <span className="text-muted">({c.note})</span>}
                <BalanceDelete id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {flows.length === 0 ? (
        <EmptyState icon={Building} title={`${year}-ben nincs bankmozgás`} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Hónap</th>
                <th className="px-2 py-2 text-right font-medium">Nyitó</th>
                <th className="px-2 py-2 text-right font-medium">Bevétel</th>
                <th className="px-2 py-2 text-right font-medium">Kiadás</th>
                <th className="px-2 py-2 text-right font-medium">Különbözet</th>
                <th className="px-4 py-2 text-right font-medium">Záró</th>
              </tr>
            </thead>
            {flows.map((f) => {
              const [, mo] = f.month.split("-").map(Number);
              const net = f.income - f.expense;
              return (
                <tbody key={f.month} className="border-b border-border-subtle last:border-0">
                  <tr>
                    <td className="px-4 pt-2 font-medium" colSpan={1}>
                      {MONTH_NAMES[mo - 1]}
                    </td>
                    <td className="px-2 pt-2 text-right tabular-nums text-muted">{formatMoney(f.opening)}</td>
                    <td className="px-2 pt-2 text-right tabular-nums text-success">+{formatMoney(f.income)}</td>
                    <td className="px-2 pt-2 text-right tabular-nums">−{formatMoney(f.expense)}</td>
                    <td className={`px-2 pt-2 text-right tabular-nums ${net < 0 ? "text-danger" : "text-success"}`}>{net > 0 ? "+" : ""}{formatMoney(net)}</td>
                    <td className={`px-4 pt-2 text-right font-semibold tabular-nums ${f.closing < 0 ? "text-danger" : ""}`}>{formatMoney(f.closing)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-4 pb-2">
                      {f.checks.map((c) => (
                        <div key={c.checkpoint.id} className="text-xs text-muted">
                          Bank szerint {formatDate(c.checkpoint.balance_date)}: <span className="font-medium text-foreground">{formatMoney(Number(c.checkpoint.balance))}</span> · a tételekből: {formatMoney(c.computed)} · <Diff value={c.diff} />
                        </div>
                      ))}
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-muted hover:text-foreground">Tételek (mint a Kimutatás lapon)</summary>
                        <div className="mt-2 grid gap-4 md:grid-cols-2">
                          {(
                            [
                              ["Kiadások", f.expenseGroups, f.expense],
                              ["Bevételek", f.incomeGroups, f.income],
                            ] as const
                          ).map(([title, groups, total]) => (
                            <div key={title}>
                              <div className="mb-1 font-semibold">{title}</div>
                              <table className="w-full">
                                <tbody>
                                  {groups.map(([g, v]) => (
                                    <tr key={g}>
                                      <td className="py-0.5 pr-2">{g}</td>
                                      <td className="py-0.5 text-right tabular-nums">{formatMoney(v)}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t border-border font-semibold">
                                    <td className="py-0.5">Összesen</td>
                                    <td className="py-0.5 text-right tabular-nums">{formatMoney(total)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                </tbody>
              );
            })}
          </table>
        </Card>
      )}
    </div>
  );
}

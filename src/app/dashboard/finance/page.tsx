import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, FilePlus2, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { generateDueInvoices } from "@/lib/finance-server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  INVOICE_SELECT,
  addDays,
  addMonths,
  categoryLabel,
  formatDate,
  formatMoney,
  invoiceStatus,
  payableAmount,
  settledAmount,
  szjaAmount,
  todayIso,
  type InvoiceRow,
} from "@/lib/finance";

const MONTH_NAMES = ["jan", "feb", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];

function relDays(date: string, today: string): string {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  if (diff === 0) return "ma";
  if (diff === 1) return "holnap";
  if (diff > 0) return `${diff} nap múlva`;
  return `${-diff} napja`;
}

function Stat({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  icon: typeof Landmark;
  tone?: "accent" | "danger" | "success" | "warning";
}) {
  const toneClass = {
    accent: "bg-accent-soft text-accent-hover",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  }[tone];
  return (
    <Link href={href} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="text-sm text-muted">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
      </div>
    </Link>
  );
}

function InvoiceList({
  title,
  empty,
  items,
  today,
  dateOf,
  companyQuery,
}: {
  title: string;
  empty: string;
  items: InvoiceRow[];
  today: string;
  dateOf: (inv: InvoiceRow) => string | null;
  companyQuery: string;
}) {
  return (
    <Card className="flex flex-col p-0">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
        {title} <span className="font-normal text-muted">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {items.slice(0, 8).map((inv) => {
            const d = dateOf(inv);
            const late = d !== null && d < today;
            return (
              <Link
                key={inv.id}
                href={`/dashboard/finance/invoices/${inv.id}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-background"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{inv.counterparty_name}</div>
                  <div className="truncate text-xs text-muted">
                    {inv.description}
                    {inv.location && ` · ${inv.location}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular-nums">{formatMoney(payableAmount(inv), inv.currency)}</div>
                  {d && <div className={`text-xs ${late ? "font-medium text-danger" : "text-muted"}`}>{relDays(d, today)}</div>}
                </div>
              </Link>
            );
          })}
          {items.length > 8 && (
            <Link href={`/dashboard/finance/invoices?status=todo${companyQuery}`} className="block px-4 py-2 text-center text-xs text-accent hover:underline">
              További {items.length - 8} tétel →
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

export default async function FinanceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const supabase = await createClient();
  await generateDueInvoices(supabase);

  const today = todayIso();
  const firstMonth = addMonths(today, -11);
  let query = supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .or(`issue_date.gte.${firstMonth},paid_date.gte.${firstMonth},paid_date.is.null`);
  if (company) query = query.eq("company_id", company);
  const [{ data }, { count: companyCount }] = await Promise.all([
    query.limit(5000),
    supabase.from("finance_companies").select("id", { count: "exact", head: true }),
  ]);
  const all = (data ?? []) as InvoiceRow[];
  const companyQuery = company ? `&company=${company}` : "";

  if (!companyCount) {
    return (
      <Card className="flex flex-col gap-2 p-6">
        <h1 className="text-lg font-semibold">Pénzügyek — első lépések</h1>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            <Link href="/dashboard/finance/companies" className="text-accent hover:underline">
              Vedd fel a cégeket
            </Link>{" "}
            (pl. Workerbase, Interprop, Bluegate).
          </li>
          <li>Hozd létre a számla-törzseket az ismétlődő számlákhoz (havi bérleti díjak, rezsi, bérbeadóknak fizetett díjak).</li>
          <li>Rögzítsd az egyedi számlákat és pénzmozgásokat — a kifizetést / banki könyvelést egy kattintással pipálhatod.</li>
        </ol>
      </Card>
    );
  }

  const huf = all.filter((i) => i.currency === "HUF");
  const hasEur = all.some((i) => i.currency === "EUR");

  const toIssue = all.filter((i) => i.direction === "out" && i.is_planned).sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  const receivables = all
    .filter((i) => i.direction === "out" && !i.is_planned && !i.paid_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const payables = all
    .filter((i) => i.direction === "in" && !i.paid_date)
    .sort((a, b) => (a.due_date ?? a.issue_date).localeCompare(b.due_date ?? b.issue_date));
  const toBook = all.filter((i) => invoiceStatus(i, today) === "paid");

  const sumHuf = (items: InvoiceRow[]) => items.filter((i) => i.currency === "HUF").reduce((s, i) => s + payableAmount(i), 0);
  const overdueReceivables = receivables.filter((i) => i.due_date && i.due_date < today);
  const overduePayables = payables.filter((i) => i.due_date && i.due_date < today);
  const payablesSoon = payables.filter((i) => (i.due_date ?? i.issue_date) <= addDays(today, 7));

  // Havi pénzmozgás a kifizetés dátuma szerint (forintban)
  const months = Array.from({ length: 12 }, (_, k) => addMonths(firstMonth, k).slice(0, 7));
  const monthly = new Map(months.map((m) => [m, { income: 0, expense: 0, szja: 0 }]));
  for (const inv of huf) {
    if (!inv.paid_date) continue;
    const m = monthly.get(inv.paid_date.slice(0, 7));
    if (!m) continue;
    if (inv.direction === "out") m.income += settledAmount(inv);
    else {
      m.expense += settledAmount(inv);
      if (inv.szja_withheld) m.szja += szjaAmount(Number(inv.gross_amount));
    }
  }
  const maxBar = Math.max(1, ...[...monthly.values()].flatMap((m) => [m.income, m.expense]));
  const thisMonth = monthly.get(today.slice(0, 7))!;

  // Kiadások kategóriánként az idei évben
  const year = today.slice(0, 4);
  const byCategory = new Map<string, number>();
  for (const inv of huf) {
    if (inv.direction !== "in" || !inv.paid_date?.startsWith(year)) continue;
    byCategory.set(inv.category, (byCategory.get(inv.category) ?? 0) + settledAmount(inv));
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categories.map(([, v]) => v));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pénzügyek"
        description="Mit kell kiszámlázni, mi nincs még kifizetve, és hogyan alakul a bevétel és a kiadás."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Számlázandó"
          value={String(toIssue.length)}
          sub={toIssue.length ? `${formatMoney(sumHuf(toIssue))} · legkorábbi: ${relDays(toIssue[0].issue_date, today)}` : "Nincs teendő"}
          href={`/dashboard/finance/invoices?status=planned&dir=out${companyQuery}`}
          icon={FilePlus2}
          tone={toIssue.some((i) => i.issue_date <= today) ? "warning" : "accent"}
        />
        <Stat
          label="Kintlévőség (kiállított, nincs fizetve)"
          value={formatMoney(sumHuf(receivables))}
          sub={overdueReceivables.length ? `ebből lejárt: ${formatMoney(sumHuf(overdueReceivables))} (${overdueReceivables.length} db)` : "Nincs lejárt"}
          href={`/dashboard/finance/invoices?status=todo&dir=out${companyQuery}`}
          icon={ArrowUpRight}
          tone={overdueReceivables.length ? "danger" : "success"}
        />
        <Stat
          label="Fizetendő"
          value={formatMoney(sumHuf(payables))}
          sub={overduePayables.length ? `ebből lejárt: ${formatMoney(sumHuf(overduePayables))} (${overduePayables.length} db)` : "Nincs lejárt"}
          href={`/dashboard/finance/invoices?status=todo&dir=in${companyQuery}`}
          icon={ArrowDownLeft}
          tone={overduePayables.length ? "danger" : "accent"}
        />
        <Stat
          label="Könyvelésre vár (bankkivonat)"
          value={String(toBook.length)}
          sub="Kifizetve, de a banki könyvelés dátuma hiányzik"
          href={`/dashboard/finance/invoices?status=paid${companyQuery}`}
          icon={Landmark}
          tone={toBook.length ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InvoiceList
          title="Számlázni kell"
          empty="Nincs kiállítandó számla a következő napokban."
          items={toIssue}
          today={today}
          dateOf={(i) => i.issue_date}
          companyQuery={companyQuery}
        />
        <InvoiceList
          title="Nem fizettek még (kimenő)"
          empty="Minden kiállított számlát kifizettek."
          items={receivables}
          today={today}
          dateOf={(i) => i.due_date}
          companyQuery={companyQuery}
        />
        <InvoiceList
          title="Fizetni kell 7 napon belül"
          empty="Nincs közeli fizetési határidő."
          items={payablesSoon}
          today={today}
          dateOf={(i) => i.due_date ?? i.issue_date}
          companyQuery={companyQuery}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="flex flex-col gap-4 p-5 xl:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Havi pénzmozgás (kifizetés szerint)</h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-success" /> Bevétel
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-danger/70" /> Kiadás
              </span>
            </div>
          </div>
          <div className="flex h-40 items-end gap-1.5">
            {months.map((m) => {
              const v = monthly.get(m)!;
              return (
                <div key={m} className="flex h-full flex-1 flex-col justify-end" title={`${m}: bevétel ${formatMoney(v.income)}, kiadás ${formatMoney(v.expense)}`}>
                  <div className="flex flex-1 items-end justify-center gap-0.5">
                    <div className="w-1/2 max-w-4 rounded-t bg-success" style={{ height: `${(v.income / maxBar) * 100}%` }} />
                    <div className="w-1/2 max-w-4 rounded-t bg-danger/70" style={{ height: `${(v.expense / maxBar) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-center text-[10px] text-muted">{MONTH_NAMES[Number(m.slice(5)) - 1]}</div>
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-1.5 font-medium">Hónap</th>
                  <th className="py-1.5 text-right font-medium">Bevétel</th>
                  <th className="py-1.5 text-right font-medium">Kiadás</th>
                  <th className="py-1.5 text-right font-medium">Egyenleg</th>
                  <th className="py-1.5 text-right font-medium" title="Magánszemély bérbeadóktól levont, a NAV-nak befizetendő SZJA">
                    Levont SZJA
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => {
                  const v = monthly.get(m)!;
                  const balance = v.income - v.expense;
                  return (
                    <tr key={m} className="border-b border-border-subtle tabular-nums last:border-0">
                      <td className="py-1.5">{formatDate(m)}</td>
                      <td className="py-1.5 text-right">{formatMoney(v.income)}</td>
                      <td className="py-1.5 text-right">{formatMoney(v.expense)}</td>
                      <td className={`py-1.5 text-right font-medium ${balance < 0 ? "text-danger" : "text-success"}`}>{formatMoney(balance)}</td>
                      <td className="py-1.5 text-right text-muted">{v.szja ? formatMoney(v.szja) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasEur && <p className="text-xs text-muted">Az euróban rögzített tételek nem szerepelnek a forintos összesítőkben.</p>}
        </Card>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card className="grid grid-cols-3 gap-2 p-5 text-center">
            <div>
              <div className="text-xs text-muted">Bevétel e hónapban</div>
              <div className="mt-1 font-semibold tabular-nums text-success">{formatMoney(thisMonth.income)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Kiadás e hónapban</div>
              <div className="mt-1 font-semibold tabular-nums text-danger">{formatMoney(thisMonth.expense)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Egyenleg</div>
              <div className={`mt-1 font-semibold tabular-nums ${thisMonth.income - thisMonth.expense < 0 ? "text-danger" : "text-success"}`}>
                {formatMoney(thisMonth.income - thisMonth.expense)}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">Kiadások kategóriánként ({year})</h2>
            {categories.length === 0 ? (
              <p className="text-sm text-muted">Idén még nincs kifizetett kiadás.</p>
            ) : (
              categories.map(([cat, value]) => (
                <div key={cat} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-muted">{categoryLabel(cat)}</span>
                    <span className="font-medium tabular-nums">{formatMoney(value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-background">
                    <div className="h-full rounded bg-accent" style={{ width: `${(value / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </Card>

          {overdueReceivables.length + overduePayables.length > 0 && (
            <Card className="flex items-start gap-3 border-danger/40 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div>
                <div className="font-medium text-foreground">Lejárt határidők</div>
                <div className="text-muted">
                  {overdueReceivables.length > 0 && <>{overdueReceivables.length} kimenő számlát nem fizettek ki határidőre. </>}
                  {overduePayables.length > 0 && <>{overduePayables.length} bejövő tétel fizetési határideje lejárt.</>}
                </div>
                <Link href={`/dashboard/finance/invoices?status=overdue${companyQuery}`} className="mt-1 inline-block text-xs text-accent hover:underline">
                  Lejártak listája →
                </Link>
              </div>
              <Badge variant="danger" className="ml-auto">
                {overdueReceivables.length + overduePayables.length}
              </Badge>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

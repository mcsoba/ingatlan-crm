import Link from "next/link";
import { ChevronLeft, ChevronRight, Paperclip, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { getSelectedCompanyId } from "@/lib/companies";
import { loadFormOptions } from "../data";
import { QuickExpenseForm } from "./quick-expense-form";
import { deleteInvoiceRow } from "../actions";
import { RowDelete } from "../row-delete";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import {
  EXPENSE_CATEGORY_VALUES,
  INVOICE_SELECT,
  PAYMENT_METHOD_LABELS,
  addMonths,
  categoryLabel,
  daysInMonth,
  formatDate,
  formatMoney,
  settledAmount,
  todayIso,
  type Currency,
  type InvoiceRow,
} from "@/lib/finance";

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; company?: string; cat?: string; method?: string; paid?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  // "all" = minden cég (felülírja az oldalsávban kiválasztottat)
  const companyParam = sp.company ?? (await getSelectedCompanyId()) ?? "all";
  const company = companyParam === "all" ? undefined : companyParam;
  const cat = (EXPENSE_CATEGORY_VALUES as readonly string[]).includes(sp.cat ?? "") ? sp.cat! : "";
  const method = sp.method && sp.method in PAYMENT_METHOD_LABELS ? sp.method : "";
  const paidFilter = sp.paid === "yes" || sp.paid === "no" ? sp.paid : "";
  const q = sp.q?.trim().replace(/[%,()]/g, " ") ?? "";
  // A hónap-lapozás és a szűrő-űrlap ugyanezeket a paramétereket viszi tovább
  const keep = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ month, company: sp.company ?? "", cat, method, paid: paidFilter, q, ...patch })) if (v) params.set(k, v);
    return `/dashboard/finance/expenses?${params}`;
  };

  const supabase = await createClient();
  let query = supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("direction", "in")
    .in("category", [...EXPENSE_CATEGORY_VALUES])
    .gte("issue_date", `${month}-01`)
    .lte("issue_date", `${month}-${daysInMonth(y, m)}`)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (company) query = query.eq("company_id", company);
  if (cat) query = query.eq("category", cat);
  if (method) query = query.eq("payment_method", method);
  if (paidFilter === "yes") query = query.not("paid_date", "is", null);
  if (paidFilter === "no") query = query.is("paid_date", null);
  if (q) query = query.or(["description", "counterparty_name", "invoice_number", "notes"].map((c) => `${c}.ilike.%${q}%`).join(","));

  const [{ data }, options, { profile }] = await Promise.all([query, loadFormOptions(supabase), ensureCurrentUserProfile()]);
  const expenses = (data ?? []) as InvoiceRow[];
  const companyName = new Map(options.companies.map((c) => [c.id, c.name]));

  const ids = expenses.map((e) => e.id);
  const receiptCount = new Map<string, number>();
  if (ids.length) {
    const { data: rows } = await supabase.from("finance_receipts").select("invoice_id").in("invoice_id", ids);
    for (const r of rows ?? []) receiptCount.set(r.invoice_id, (receiptCount.get(r.invoice_id) ?? 0) + 1);
  }

  const totals = new Map<Currency, number>();
  const byCompany = new Map<string, number>();
  for (const e of expenses) {
    const amount = settledAmount(e);
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + amount);
    if (e.currency === "HUF") byCompany.set(e.company_id, (byCompany.get(e.company_id) ?? 0) + amount);
  }
  const unpaidCount = expenses.filter((e) => !e.paid_date).length;
  const missingReceipt = expenses.filter((e) => !receiptCount.get(e.id)).length;

  const prev = addMonths(`${month}-01`, -1).slice(0, 7);
  const next = addMonths(`${month}-01`, 1).slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kiadások"
        description="A cégek egyéb kiadásai (beszerzés, szolgáltatás, bankköltség, készpénz). Rögzítsd pár mezővel, és fotózd le hozzá a blokkot — telefonon a fotó gomb a kamerát is felajánlja."
      />

      {options.companies.length === 0 ? (
        <p className="text-sm text-muted">
          Előbb vegyél fel legalább egy céget a{" "}
          <Link href="/dashboard/finance/companies" className="text-accent hover:underline">
            Cégek
          </Link>{" "}
          fülön.
        </p>
      ) : (
        <QuickExpenseForm
          agencyId={profile.agency_id}
          companies={options.companies}
          defaultCompanyId={company}
          partners={options.partners}
          today={today}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={keep({ month: prev })} className={buttonVariants("secondary", "sm")} aria-label="Előző hónap">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold">
            {y}. {MONTH_NAMES[m - 1]}
          </span>
          <Link href={keep({ month: next })} className={buttonVariants("secondary", "sm")} aria-label="Következő hónap">
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[...totals.entries()].map(([cur, sum]) => (
            <span key={cur} className="font-semibold tabular-nums">
              Összesen: {formatMoney(sum, cur)}
            </span>
          ))}
          {unpaidCount > 0 && <Badge variant="danger">{unpaidCount} nincs kifizetve</Badge>}
          {missingReceipt > 0 && <Badge variant="warning">{missingReceipt} tételhez nincs blokk</Badge>}
        </div>
      </div>

      <form action="/dashboard/finance/expenses" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="month" value={month} />
        {options.companies.length > 0 && (
          <select name="company" defaultValue={companyParam} className={`${inputClass} w-auto py-1.5`}>
            <option value="all">Minden cég</option>
            {options.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input name="q" defaultValue={q} placeholder="Keresés (mire, kitől, számlaszám, megjegyzés)" className={`${inputClass} min-w-[220px] flex-1 py-1.5`} />
        <select name="cat" defaultValue={cat} className={`${inputClass} w-auto py-1.5`}>
          <option value="">Minden kategória</option>
          {EXPENSE_CATEGORY_VALUES.map((v) => (
            <option key={v} value={v}>
              {categoryLabel(v)}
            </option>
          ))}
        </select>
        <select name="method" defaultValue={method} className={`${inputClass} w-auto py-1.5`}>
          <option value="">Minden fizetési mód</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="paid" defaultValue={paidFilter} className={`${inputClass} w-auto py-1.5`}>
          <option value="">Kifizetve és nem kifizetve</option>
          <option value="yes">Csak kifizetett</option>
          <option value="no">Csak ki nem fizetett</option>
        </select>
        <button type="submit" className={buttonVariants("secondary", "sm")}>
          Szűrés
        </button>
        {(cat || method || paidFilter || q) && (
          <Link href={`/dashboard/finance/expenses?month=${month}`} className="text-xs text-muted hover:text-foreground">
            Szűrők törlése
          </Link>
        )}
      </form>

      {!company && byCompany.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...byCompany.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, sum]) => (
              <span key={id} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted">
                {companyName.get(id) ?? "?"}: <span className="font-medium text-foreground">{formatMoney(sum)}</span>
              </span>
            ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="Ebben a hónapban még nincs rögzített kiadás" description="A fenti űrlappal pár másodperc alatt felvehető." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Dátum</th>
                <th className="px-2 py-2 font-medium">Mire</th>
                <th className="px-2 py-2 font-medium">Cég</th>
                <th className="px-2 py-2 font-medium">Kategória</th>
                <th className="px-2 py-2 font-medium">Mód</th>
                <th className="px-2 py-2 font-medium">Blokk</th>
                <th className="px-4 py-2 text-right font-medium">Összeg</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const href = `/dashboard/finance/invoices/${e.id}?back=${encodeURIComponent(keep({}))}`;
                const count = receiptCount.get(e.id) ?? 0;
                return (
                  <tr key={e.id} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDate(e.issue_date)}</td>
                    <td className="max-w-[300px] px-2 py-2">
                      <Link href={href} className="font-medium text-foreground hover:underline">
                        {e.description}
                      </Link>
                      {e.counterparty_name !== e.description && <div className="text-xs text-muted">{e.counterparty_name}</div>}
                    </td>
                    <td className="px-2 py-2 text-xs">{companyName.get(e.company_id)}</td>
                    <td className="px-2 py-2 text-xs">{categoryLabel(e.category)}</td>
                    <td className="px-2 py-2 text-xs">
                      {PAYMENT_METHOD_LABELS[e.payment_method]}
                      {e.paid_date ? (
                        <div className="font-medium text-success">✓ kifizetve {formatDate(e.paid_date)}</div>
                      ) : (
                        <div className="font-medium text-danger">✗ nincs kifizetve</div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {count ? (
                        <Link href={href} className="inline-flex items-center gap-1 text-xs text-accent">
                          <Paperclip className="h-3.5 w-3.5" />
                          {count}
                        </Link>
                      ) : (
                        <Link href={href} className="text-xs text-warning hover:underline">
                          hiányzik
                        </Link>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">
                      {formatMoney(settledAmount(e), e.currency)}
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      <RowDelete id={e.id} action={deleteInvoiceRow} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

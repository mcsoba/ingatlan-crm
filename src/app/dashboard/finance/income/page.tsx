import Link from "next/link";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/companies";
import { loadFormOptions } from "../data";
import { QuickIncomeForm } from "./quick-income-form";
import { deleteInvoiceRow } from "../actions";
import { RowDelete } from "../row-delete";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import {
  CATEGORIES,
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

/** Bevételek: minden befolyó (és várt) pénz egy helyen — kiállított számlák és számla nélküli bevételek. */
export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; company?: string; cat?: string; got?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const companyParam = sp.company ?? (await getSelectedCompanyId()) ?? "all";
  const company = companyParam === "all" ? undefined : companyParam;
  const cat = CATEGORIES.some((c) => c.value === sp.cat) ? sp.cat! : "";
  const got = sp.got === "yes" || sp.got === "no" ? sp.got : "";
  const q = sp.q?.trim().replace(/[%,()]/g, " ") ?? "";
  const keep = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ month, company: sp.company ?? "", cat, got, q, ...patch })) if (v) params.set(k, v);
    return `/dashboard/finance/income?${params}`;
  };

  const supabase = await createClient();
  let query = supabase
    .from("finance_invoices")
    .select(INVOICE_SELECT)
    .eq("direction", "out")
    .gte("issue_date", `${month}-01`)
    .lte("issue_date", `${month}-${daysInMonth(y, m)}`)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (company) query = query.eq("company_id", company);
  if (cat) query = query.eq("category", cat);
  if (got === "yes") query = query.not("paid_date", "is", null);
  if (got === "no") query = query.is("paid_date", null);
  if (q) query = query.or(["description", "counterparty_name", "invoice_number", "notes", "location"].map((c) => `${c}.ilike.%${q}%`).join(","));

  const [{ data }, options] = await Promise.all([query, loadFormOptions(supabase)]);
  const items = (data ?? []) as InvoiceRow[];
  const companyName = new Map(options.companies.map((c) => [c.id, c.name]));

  const received = new Map<Currency, number>();
  const expected = new Map<Currency, number>();
  const byCompany = new Map<string, number>();
  for (const i of items) {
    const amount = settledAmount(i);
    const target = i.paid_date ? received : expected;
    target.set(i.currency, (target.get(i.currency) ?? 0) + amount);
    if (i.paid_date && i.currency === "HUF") byCompany.set(i.company_id, (byCompany.get(i.company_id) ?? 0) + amount);
  }
  const overdue = items.filter((i) => !i.paid_date && !i.is_planned && i.due_date && i.due_date < today).length;
  const toIssue = items.filter((i) => i.is_planned).length;

  const prev = addMonths(`${month}-01`, -1).slice(0, 7);
  const next = addMonths(`${month}-01`, 1).slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Bevételek"
        description="Minden pénz, ami befolyik vagy befolyik majd: a kiállított számlák és a számla nélküli bevételek (pl. készpénzben kapott bérleti díj, kaució, jutalék). Lent látod, mi érkezett meg és mi nem."
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
        <QuickIncomeForm companies={options.companies} defaultCompanyId={company} partners={options.partners} today={today} />
      )}
      <p className="-mt-2 text-xs text-muted">
        Rendszeres (havi) bevételhez, pl. bérleti díjhoz inkább{" "}
        <Link href="/dashboard/finance/schedules/new" className="text-accent hover:underline">
          számla-törzset
        </Link>{" "}
        vegyél fel — onnan a rendszer minden hónapban magától előkészíti a számlát.
      </p>

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
          {[...received.entries()].map(([cur, sum]) => (
            <span key={`r${cur}`} className="font-semibold tabular-nums text-success">
              Befolyt: {formatMoney(sum, cur)}
            </span>
          ))}
          {[...expected.entries()].map(([cur, sum]) => (
            <span key={`e${cur}`} className="tabular-nums text-muted">
              Még várjuk: {formatMoney(sum, cur)}
            </span>
          ))}
          {overdue > 0 && <Badge variant="danger">{overdue} lejárt, nem fizették ki</Badge>}
          {toIssue > 0 && <Badge variant="warning">{toIssue} számlát még ki kell állítani</Badge>}
        </div>
      </div>

      <form action="/dashboard/finance/income" className="flex flex-wrap items-end gap-2">
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
        <input name="q" defaultValue={q} placeholder="Keresés (kitől, mi után, számlaszám, cím)" className={`${inputClass} min-w-[220px] flex-1 py-1.5`} />
        <select name="cat" defaultValue={cat} className={`${inputClass} w-auto py-1.5`}>
          <option value="">Minden kategória</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="got" defaultValue={got} className={`${inputClass} w-auto py-1.5`}>
          <option value="">Megérkezett és várt is</option>
          <option value="yes">Csak megérkezett</option>
          <option value="no">Csak még nem érkezett meg</option>
        </select>
        <button type="submit" className={buttonVariants("secondary", "sm")}>
          Szűrés
        </button>
        {(cat || got || q) && (
          <Link href={`/dashboard/finance/income?month=${month}`} className="text-xs text-muted hover:text-foreground">
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

      {items.length === 0 ? (
        <EmptyState icon={Wallet} title="Ebben a hónapban még nincs bevétel" description="A fenti űrlappal pár másodperc alatt rögzíthető." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Dátum</th>
                <th className="px-2 py-2 font-medium">Kitől · mi után</th>
                <th className="px-2 py-2 font-medium">Cég</th>
                <th className="px-2 py-2 font-medium">Kategória</th>
                <th className="px-2 py-2 font-medium">Állapot</th>
                <th className="px-4 py-2 text-right font-medium">Összeg</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const href = `/dashboard/finance/invoices/${i.id}?back=${encodeURIComponent(keep({}))}`;
                const late = !i.paid_date && !i.is_planned && i.due_date && i.due_date < today;
                return (
                  <tr key={i.id} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDate(i.issue_date)}</td>
                    <td className="max-w-[320px] px-2 py-2">
                      <Link href={href} className="font-medium text-foreground hover:underline">
                        {i.counterparty_name}
                      </Link>
                      <div className="text-xs text-muted">
                        {[i.description, i.invoice_number].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs">{companyName.get(i.company_id)}</td>
                    <td className="px-2 py-2 text-xs">{categoryLabel(i.category)}</td>
                    <td className="px-2 py-2 text-xs">
                      {i.is_planned ? (
                        <Link href={href} className="font-medium text-warning hover:underline">
                          Számlát ki kell állítani
                        </Link>
                      ) : i.paid_date ? (
                        <span className="font-medium text-success">✓ megérkezett {formatDate(i.paid_date)}</span>
                      ) : (
                        <span className={`font-medium ${late ? "text-danger" : "text-muted"}`}>
                          {late ? `✗ lejárt (${formatDate(i.due_date)})` : `várjuk ${i.due_date ? formatDate(i.due_date) : ""}`}
                        </span>
                      )}
                      <div className="text-muted">{PAYMENT_METHOD_LABELS[i.payment_method]}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums text-success">
                      +{formatMoney(settledAmount(i), i.currency)}
                    </td>
                    <td className="w-8 px-2 py-2 text-right">
                      <RowDelete id={i.id} action={deleteInvoiceRow} />
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

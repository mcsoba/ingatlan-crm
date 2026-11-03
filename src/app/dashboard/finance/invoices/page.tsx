import Link from "next/link";
import { Check, Download, Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { generateDueInvoices } from "@/lib/finance-server";
import { getSelectedCompanyId } from "@/lib/companies";
import { markInvoice } from "../actions";
import { STATUS_FILTERS, loadInvoices, type InvoiceFilters } from "../data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import {
  CATEGORIES,
  PAYMENT_METHOD_LABELS,
  STATUS_VARIANT,
  categoryLabel,
  formatDate,
  formatMoney,
  formatPeriod,
  invoiceStatus,
  payableAmount,
  statusLabel,
  todayIso,
  type Currency,
  type InvoiceRow,
} from "@/lib/finance";

const MONTHS = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];

function query(base: InvoiceFilters, patch: Partial<InvoiceFilters>): string {
  const merged = { ...base, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Gyors pipálás egy cellában: kitöltött dátum, vagy (pirosas háttérrel) a pipáló gomb. */
function TickCell({
  inv,
  value,
  action,
  label,
  exempt,
}: {
  inv: InvoiceRow;
  value: string | null;
  action: "paid" | "booked";
  label: string;
  exempt?: boolean;
}) {
  if (value) return <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatDate(value)}</td>;
  if (inv.is_planned || exempt) return <td className="px-2 py-2 text-muted-subtle">—</td>;
  return (
    <td className="bg-danger-soft/60 px-2 py-1.5">
      <form action={markInvoice}>
        <input type="hidden" name="id" value={inv.id} />
        <input type="hidden" name="action" value={action} />
        <button
          type="submit"
          title={`${label} ma`}
          className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-surface px-1.5 py-0.5 text-xs text-danger hover:border-success hover:text-success"
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
          {label}
        </button>
      </form>
    </td>
  );
}

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceFilters>;
}) {
  const sp = await searchParams;
  const filters: InvoiceFilters = {
    ...sp,
    company: sp.company ?? (await getSelectedCompanyId()) ?? undefined,
    year: sp.year ?? String(new Date().getFullYear()),
  };
  const supabase = await createClient();
  await generateDueInvoices(supabase);
  const invoices = await loadInvoices(supabase, filters);
  const today = todayIso();
  const listPath = `/dashboard/finance/invoices${query(filters, {})}`;

  const totals = new Map<Currency, { gross: number; open: number }>();
  for (const inv of invoices) {
    const t = totals.get(inv.currency) ?? { gross: 0, open: 0 };
    t.gross += Number(inv.gross_amount);
    if (!inv.paid_date) t.open += payableAmount(inv);
    totals.set(inv.currency, t);
  }

  const year = Number(filters.year);
  // Gyors szűrők a napi teendőkhöz, egyszerű szavakkal (irány + állapot)
  const quickFilters: { label: string; dir: string; status: string }[] = [
    { label: "Minden tétel", dir: "", status: "" },
    { label: "Számlát kell kiállítani", dir: "out", status: "planned" },
    { label: "Még nem fizettek nekünk", dir: "out", status: "todo" },
    { label: "Nekünk kell fizetni", dir: "in", status: "todo" },
    { label: "Lejárt határidő", dir: "", status: "overdue" },
    { label: "Bankkivonattal egyeztetni", dir: "", status: "paid" },
    { label: "Csak bevételek", dir: "out", status: "" },
    { label: "Csak kiadások", dir: "in", status: "" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Számlák és tételek"
        description="Minden kapott és kiállított számla, díjbekérő és pénzmozgás. Piros cella = még nincs kifizetve vagy nincs kipipálva a bankkivonat alapján — egy kattintással pipálható, mint az Excelben."
        action={
          <>
            <a href={`/dashboard/finance/export${query(filters, {})}`} className={buttonVariants("secondary", "sm")}>
              <Download className="h-3.5 w-3.5" />
              Export (Excel/CSV)
            </a>
            <Link
              href={`/dashboard/finance/invoices/new${query({}, { company: filters.company, dir: filters.dir })}`}
              className={buttonVariants("primary", "sm")}
            >
              <Plus className="h-3.5 w-3.5" />
              Új tétel
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1">
        {quickFilters.map((f) => {
          const active = (filters.dir ?? "") === f.dir && (filters.status ?? "") === f.status;
          return (
            <Link
              key={f.label}
              href={`/dashboard/finance/invoices${query(filters, { dir: f.dir, status: f.status })}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                active ? "border-accent bg-accent-soft font-medium text-accent-hover" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <form className="flex flex-wrap items-end gap-2">
        {filters.company && <input type="hidden" name="company" value={filters.company} />}
        {filters.dir && <input type="hidden" name="dir" value={filters.dir} />}
        <input name="q" defaultValue={filters.q} placeholder="Keresés (partner, tartalom, számlaszám, cím)" className={`${inputClass} min-w-[220px] flex-1 py-1.5`} />
        <select name="status" defaultValue={filters.status ?? ""} className={`${inputClass} py-1.5`}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="cat" defaultValue={filters.cat ?? ""} className={`${inputClass} py-1.5`}>
          <option value="">Minden kategória</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="year" defaultValue={filters.year} className={`${inputClass} py-1.5`}>
          {[year + 1, year, year - 1, year - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select name="month" defaultValue={filters.month ?? ""} className={`${inputClass} py-1.5`}>
          <option value="">Egész év</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants("secondary", "sm")}>
          Szűrés
        </button>
      </form>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nincs a szűrésnek megfelelő tétel"
          description="Rögzíts új tételt, vagy hozz létre számla-törzset az ismétlődő számlákhoz — azokból a rendszer magától előkészíti a tételeket."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Állapot</th>
                <th className="px-2 py-2 font-medium">Számlaszám</th>
                <th className="px-2 py-2 font-medium">Partner</th>
                <th className="px-2 py-2 font-medium">Tartalom</th>
                <th className="px-2 py-2 font-medium">Időszak</th>
                <th className="px-2 py-2 font-medium">Kelte</th>
                <th className="px-2 py-2 font-medium">Határidő</th>
                <th className="px-2 py-2 font-medium">Kifizetve</th>
                <th className="px-2 py-2 font-medium">Bank könyv.</th>
                <th className="px-2 py-2 font-medium">Mód</th>
                <th className="px-3 py-2 text-right font-medium">Bruttó</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = invoiceStatus(inv, today);
                const href = `/dashboard/finance/invoices/${inv.id}?back=${encodeURIComponent(listPath)}`;
                return (
                  <tr key={inv.id} className="border-b border-border-subtle align-top last:border-0 hover:bg-background/60">
                    <td className="px-3 py-2">
                      <Link href={href}>
                        <Badge variant={STATUS_VARIANT[status]}>{statusLabel(status, inv.direction)}</Badge>
                      </Link>
                      <div className="mt-1 text-[11px] text-muted">{inv.direction === "out" ? "bevétel (kimenő)" : "kiadás (bejövő)"}</div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {inv.is_planned && inv.direction === "out" ? (
                        <Link href={href} className="text-xs font-medium text-accent hover:underline">
                          Kiállítás →
                        </Link>
                      ) : (
                        <Link href={href} className="hover:underline">
                          {inv.invoice_number || <span className="text-muted-subtle">—</span>}
                        </Link>
                      )}
                    </td>
                    <td className="max-w-[200px] px-2 py-2">
                      <Link href={href} className="font-medium text-foreground hover:underline">
                        {inv.counterparty_name}
                      </Link>
                    </td>
                    <td className="max-w-[260px] px-2 py-2">
                      <div>{inv.description}</div>
                      <div className="text-xs text-muted">
                        {categoryLabel(inv.category)}
                        {inv.location && ` · ${inv.location}`}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums">{formatPeriod(inv.period_start, inv.period_end)}</td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatDate(inv.issue_date)}</td>
                    <td className={`whitespace-nowrap px-2 py-2 tabular-nums ${status === "overdue" ? "font-medium text-danger" : ""}`}>
                      {formatDate(inv.due_date)}
                    </td>
                    <TickCell inv={inv} value={inv.paid_date} action="paid" label="Fizetve" />
                    <TickCell inv={inv} value={inv.bank_booked_date} action="booked" label="Könyvelve" exempt={inv.payment_method === "cash"} />
                    <td className="whitespace-nowrap px-2 py-2 text-xs">{PAYMENT_METHOD_LABELS[inv.payment_method]}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                      {formatMoney(Number(inv.gross_amount), inv.currency)}
                      {inv.szja_withheld && (
                        <div className="text-[11px] font-normal text-muted">fizetendő: {formatMoney(payableAmount(inv), inv.currency)}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {[...totals.entries()].map(([cur, t]) => (
                <tr key={cur} className="border-t border-border text-sm">
                  <td colSpan={10} className="px-3 py-2 text-right text-muted">
                    Összesen ({invoices.length} tétel{totals.size > 1 ? `, ${cur}` : ""}) · ebből rendezetlen: {formatMoney(t.open, cur)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{formatMoney(t.gross, cur)}</td>
                </tr>
              ))}
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}

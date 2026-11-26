import Link from "next/link";
import { Building, ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { loadInvoiceExtras } from "@/lib/finance-extras";
import { INVOICE_SELECT, STATUS_VARIANT, formatDate, formatMoney, invoiceStatus, payableAmount, statusLabel, todayIso, type InvoiceRow } from "@/lib/finance";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

type PartnerSum = { name: string; role: "customer" | "supplier"; count: number; net: number; gross: number; open: number; last: string };

function PartnerTable({ title, list, yearParam }: { title: string; list: PartnerSum[]; yearParam: string }) {
  return (
    <Card className="overflow-x-auto p-0">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold">{title}</div>
      {list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Nincs tétel.</p>
      ) : (
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-1.5 font-medium">Partner</th>
              <th className="px-2 py-1.5 text-right font-medium">Tétel</th>
              <th className="px-2 py-1.5 text-right font-medium">Nettó</th>
              <th className="px-2 py-1.5 text-right font-medium">Nyitott</th>
              <th className="px-4 py-1.5 text-right font-medium">Utolsó</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.name} className="border-t border-border-subtle">
                <td className="px-4 py-1.5">
                  <Link href={`/dashboard/finance/invoices?q=${encodeURIComponent(p.name)}&cat=machine&year=${yearParam}`} className="hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.count}</td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatMoney(p.net)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${p.open > 0 ? "text-warning" : "text-muted"}`}>{p.open ? formatMoney(p.open) : "—"}</td>
                <td className="px-4 py-1.5 text-right tabular-nums text-muted">{formatDate(p.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/**
 * Gépbérlés mint külön üzletág: amit bérbe adunk (kimenő, bevétel) és amit bérelünk hozzá
 * (bejövő, költség), nettóban — az ÁFA átfolyó tétel. A gépes kauciók külön (nem bevétel/költség).
 */
export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ company?: string; year?: string }> }) {
  const sp = await searchParams;
  const today = todayIso();
  const allYears = sp.year === "all";
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : Number(today.slice(0, 4));
  const companies = await listCompanies();
  const selected = await getSelectedCompanyId();
  const companyId = [sp.company, selected, companies[0]?.id].find((id) => id && companies.some((c) => c.id === id));
  if (!companyId) return <EmptyState icon={Building} title="Még nincs cég felvéve" description="Előbb vedd fel a cégeket a Cégek fülön." />;
  const link = (patch: Record<string, string>) => `/dashboard/finance/machines?${new URLSearchParams({ company: companyId, year: allYears ? "all" : String(year), ...patch })}`;

  const supabase = await createClient();
  const [machineRes, extras] = await Promise.all([
    fetchAll<InvoiceRow>(() => supabase.from("finance_invoices").select(INVOICE_SELECT).eq("company_id", companyId).eq("category", "machine").order("issue_date", { ascending: false })),
    loadInvoiceExtras(supabase),
  ]);
  if (machineRes.error) throw machineRes.error;
  const partners = [...new Set(machineRes.data.map((r) => r.counterparty_name))];
  // Gépes kaució: kaució-tétel olyan partnerrel, akivel gépbérlés is van
  const depRes = partners.length
    ? await fetchAll<InvoiceRow>(() => supabase.from("finance_invoices").select(INVOICE_SELECT).eq("company_id", companyId).eq("category", "deposit").in("counterparty_name", partners))
    : { data: [] as InvoiceRow[], error: null };
  if (depRes.error) throw depRes.error;

  const inYear = (r: InvoiceRow) => allYears || r.issue_date.startsWith(String(year));
  const valid = (r: InvoiceRow) => !extras.cancelled.has(r.id) && !r.is_planned && r.currency === "HUF";
  const rows = machineRes.data.filter((r) => inYear(r));
  const net = (r: InvoiceRow) => Number(r.net_amount);
  const income = rows.filter((r) => valid(r) && r.direction === "out");
  const cost = rows.filter((r) => valid(r) && r.direction === "in");
  const incomeNet = income.reduce((s, r) => s + net(r), 0);
  const costNet = cost.reduce((s, r) => s + net(r), 0);
  const open = (r: InvoiceRow) => valid(r) && !r.paid_date;
  const remaining = (r: InvoiceRow) => payableAmount(r) - (extras.paidSoFar.get(r.id) ?? 0);
  const receivable = machineRes.data.filter((r) => r.direction === "out" && open(r)).reduce((s, r) => s + remaining(r), 0);
  const payable = machineRes.data.filter((r) => r.direction === "in" && open(r)).reduce((s, r) => s + remaining(r), 0);

  const byPartner = new Map<string, PartnerSum>();
  for (const r of rows) {
    if (!valid(r)) continue;
    const k = `${r.direction}|${r.counterparty_name}`;
    const p: PartnerSum = byPartner.get(k) ?? { name: r.counterparty_name, role: r.direction === "out" ? "customer" : "supplier", count: 0, net: 0, gross: 0, open: 0, last: r.issue_date };
    p.count++;
    p.net += net(r);
    p.gross += Number(r.gross_amount);
    if (!r.paid_date) p.open += remaining(r);
    if (r.issue_date > p.last) p.last = r.issue_date;
    byPartner.set(k, p);
  }
  const customers = [...byPartner.values()].filter((p) => p.role === "customer").sort((a, b) => b.net - a.net);
  const suppliers = [...byPartner.values()].filter((p) => p.role === "supplier").sort((a, b) => b.net - a.net);

  // Kaució egyenleg partnerenként (minden évből — a kaució a bérlet végéig kint van)
  const deposits = new Map<string, { paid: number; received: number }>();
  for (const d of depRes.data) {
    if (!d.paid_date || extras.cancelled.has(d.id)) continue;
    const e = deposits.get(d.counterparty_name) ?? { paid: 0, received: 0 };
    if (d.direction === "in") e.paid += Number(d.gross_amount);
    else e.received += Number(d.gross_amount);
    deposits.set(d.counterparty_name, e);
  }
  const firstYear = Number((machineRes.data.at(-1)?.issue_date ?? today).slice(0, 4));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Gépbérlés"
        description="A gépbérlés mint külön üzletág: amit bérbe adunk (bevétel) és amit hozzá bérelünk (költség), nettóban — az ÁFA átfolyó tétel. A „Gépbérlés” kategóriájú tételekből; a gépes kaució külön látszik."
      />

      {companies.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => (
            <Link key={c.id} href={`/dashboard/finance/machines?company=${c.id}`} className={buttonVariants(c.id === companyId ? "primary" : "secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {machineRes.data.length === 0 ? (
        <EmptyState icon={Truck} title="Ennél a cégnél nincs gépbérlés" description="Gépbérlési tételt a „Gépbérlés” kategóriával rögzíthetsz (Bevételek / Kiadások / Számlák)." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!allYears && (
              <>
                <Link href={link({ year: String(year - 1) })} className={buttonVariants("secondary", "sm")} aria-label="Előző év">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Link>
                <span className="min-w-16 text-center text-sm font-semibold">{year}</span>
                <Link href={link({ year: String(year + 1) })} className={buttonVariants("secondary", "sm")} aria-label="Következő év">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
            <Link href={link({ year: allYears ? String(Number(today.slice(0, 4))) : "all" })} className="text-xs text-accent hover:underline">
              {allYears ? "Évenként" : `Összes év (${firstYear}-től)`}
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(
              [
                ["Bevétel (nettó)", incomeNet, `${income.length} számla a bérlőknek`, "text-success"],
                ["Költség (nettó)", -costNet, `${cost.length} tétel a beszállítóktól`, ""],
                ["Fedezet", incomeNet - costNet, incomeNet ? `${Math.round(((incomeNet - costNet) / incomeNet) * 100)}% a bevételből` : "", incomeNet - costNet < 0 ? "text-danger" : "text-success"],
                ["Kintlévőség", receivable, "bérlők, még nem fizették (bruttó)", receivable > 0 ? "text-warning" : ""],
                ["Fizetendő", -payable, "beszállítóknak, még nincs fizetve", payable > 0 ? "text-warning" : ""],
              ] as const
            ).map(([label, value, sub, tone]) => (
              <Card key={label} className="flex flex-col gap-1 p-4">
                <span className="text-xs text-muted">{label}</span>
                <span className={`text-xl font-semibold tabular-nums ${tone}`}>{formatMoney(value)}</span>
                <span className="text-[11px] text-muted">{sub}</span>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PartnerTable title="Bérlők (akiknek bérbe adjuk)" list={customers} yearParam={allYears ? "" : String(year)} />
            <PartnerTable title="Beszállítók (akiktől béreljük)" list={suppliers} yearParam={allYears ? "" : String(year)} />
          </div>

          {deposits.size > 0 && (
            <Card className="overflow-x-auto p-0">
              <div className="border-b border-border px-4 py-2 text-sm font-semibold">Gépes kaució (minden évből)</div>
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="px-4 py-1.5 font-medium">Partner</th>
                    <th className="px-2 py-1.5 text-right font-medium">Mi fizettük</th>
                    <th className="px-2 py-1.5 text-right font-medium">Nekünk fizették</th>
                    <th className="px-4 py-1.5 text-right font-medium">Egyenleg</th>
                  </tr>
                </thead>
                <tbody>
                  {[...deposits.entries()].map(([name, d]) => (
                    <tr key={name} className="border-t border-border-subtle">
                      <td className="px-4 py-1.5">{name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{d.paid ? formatMoney(d.paid) : "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{d.received ? formatMoney(d.received) : "—"}</td>
                      <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                        {d.paid - d.received > 0 ? `nekünk jár vissza ${formatMoney(d.paid - d.received)}` : d.received - d.paid > 0 ? `mi tartjuk ${formatMoney(d.received - d.paid)}` : "rendezve"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <div className="border-b border-border px-4 py-2 text-sm font-semibold">Tételek ({rows.length})</div>
            <table className="w-full min-w-[760px] text-sm">
              <tbody>
                {rows.map((r) => {
                  const status = invoiceStatus(r, today, extras);
                  return (
                    <tr key={r.id} className="border-t border-border-subtle hover:bg-background/60">
                      <td className="whitespace-nowrap px-4 py-1.5 tabular-nums text-muted">{formatDate(r.issue_date)}</td>
                      <td className="px-2 py-1.5">
                        <Link href={`/dashboard/finance/invoices/${r.id}?back=${encodeURIComponent(link({}))}`} className="font-medium hover:underline">
                          {r.counterparty_name}
                        </Link>
                        <span className="block text-xs text-muted">{[r.description, r.invoice_number].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={STATUS_VARIANT[status]}>{statusLabel(status, r.direction)}</Badge>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-muted">{r.direction === "out" ? "bevétel" : "költség"}</td>
                      <td className={`whitespace-nowrap px-4 py-1.5 text-right tabular-nums ${r.direction === "out" ? "text-success" : ""}`}>
                        {r.direction === "out" ? "+" : "−"}
                        {formatMoney(net(r))} <span className="text-xs text-muted">nettó</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

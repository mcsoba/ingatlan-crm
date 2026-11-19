import Link from "next/link";
import { Home, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { loadLodgingParties } from "../data";
import { LODGING_SELECT, daysUntil, formatDate, formatMoney, monthlyEquivalent, todayIso, type LodgingRow } from "@/lib/finance";

function EndBadge({ end, today }: { end: string | null; today: string }) {
  if (!end) return <span className="text-xs text-muted">határozatlan</span>;
  const days = daysUntil(end, today)!;
  return (
    <div>
      <div className="tabular-nums">{formatDate(end)}</div>
      {days < 0 ? (
        <Badge variant="danger">lejárt</Badge>
      ) : days <= 60 ? (
        <Badge variant="warning">{days} nap múlva lejár</Badge>
      ) : null}
    </div>
  );
}

export default async function LodgingsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; q?: string; expiring?: string }>;
}) {
  const sp = await searchParams;
  const companyParam = sp.company ?? (await getSelectedCompanyId()) ?? "all";
  const company = companyParam === "all" ? undefined : companyParam;
  const q = sp.q?.trim().replace(/[%,()]/g, " ") ?? "";
  const expiring = sp.expiring === "1";
  const today = todayIso();
  const supabase = await createClient();

  let query = supabase.from("finance_lodgings").select(LODGING_SELECT).order("address");
  if (company) query = query.eq("company_id", company);
  if (q) query = query.or(["address", "notes"].map((c) => `${c}.ilike.%${q}%`).join(","));
  const [{ data, error }, parties, companies] = await Promise.all([query, loadLodgingParties(supabase), listCompanies()]);
  if (isMissingTable(error)) return <MigrationNotice file="0045_finance_partners_lodgings.sql" />;
  const party = (id: string | null) => (id ? parties.byId.get(id) : undefined);
  const partnerName = new Map([...parties.byId].map(([id, p]) => [id, p.name]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  let lodgings = (data ?? []) as LodgingRow[];
  if (q) {
    // A partner nevére is lehessen keresni
    const all = (await supabase.from("finance_lodgings").select(LODGING_SELECT).order("address")).data as LodgingRow[] | null;
    const needle = q.toLowerCase();
    const byPartner = (all ?? []).filter(
      (l) =>
        (!company || l.company_id === company) &&
        [l.landlord_id, l.tenant_id].some((id) => id && partnerName.get(id)?.toLowerCase().includes(needle)),
    );
    const seen = new Set(lodgings.map((l) => l.id));
    lodgings = [...lodgings, ...byPartner.filter((l) => !seen.has(l.id))];
  }
  const soon = (l: LodgingRow) =>
    [l.lease_end, l.sublease_end].some((d) => {
      const n = daysUntil(d, today);
      return n !== null && n <= 60;
    });
  if (expiring) lodgings = lodgings.filter(soon);

  let totalLease = 0;
  let totalSub = 0;
  let totalCapacity = 0;
  let totalOccupants = 0;
  for (const l of lodgings) {
    totalLease += monthlyEquivalent(l.lease_fee, l.lease_frequency) ?? 0;
    totalSub += monthlyEquivalent(l.sublease_fee, l.sublease_frequency) ?? 0;
    totalCapacity += l.capacity ?? 0;
    totalOccupants += l.occupants ?? 0;
  }
  const expiringCount = ((data ?? []) as LodgingRow[]).filter(soon).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Szállások"
        description="A bérelt ingatlanok: kitől béreljük, kinek adjuk tovább, mennyiért, meddig, mekkora kaucióval. Egy szállásból egy gombnyomással lesz ismétlődő számla."
        action={
          <Link href="/dashboard/finance/lodgings/new" className={buttonVariants("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" />
            Új szállás
          </Link>
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        {companies.length > 0 && (
          <select name="company" defaultValue={companyParam} className={`${inputClass} w-auto py-1.5`}>
            <option value="all">Minden cég</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input name="q" defaultValue={q} placeholder="Keresés (cím, bérbeadó, bérlő)" className={`${inputClass} min-w-[220px] flex-1 py-1.5`} />
        <label className="flex items-center gap-2 px-1 text-sm text-muted">
          <input type="checkbox" name="expiring" value="1" defaultChecked={expiring} />
          60 napon belül lejár{expiringCount > 0 && ` (${expiringCount})`}
        </label>
        <button type="submit" className={buttonVariants("secondary", "sm")}>
          Szűrés
        </button>
      </form>

      {lodgings.length === 0 ? (
        <EmptyState
          icon={Home}
          title={q || expiring ? "Nincs a szűrésnek megfelelő szállás" : "Még nincs szállás felvéve"}
          description="Vedd fel a bérelt ingatlanokat: cím, a bérbeadó és a bérlő adatai, díjak, kaució — minden egy helyen, mint az Excelben."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Cím</th>
                <th className="px-2 py-2 font-medium">Bérbeadó · díj / hó</th>
                <th className="px-2 py-2 font-medium">Adóaz. · bankszámla</th>
                <th className="px-2 py-2 font-medium">Bérlő · díj / hó</th>
                <th className="px-2 py-2 font-medium">Bérlő adószáma</th>
                <th className="px-2 py-2 text-right font-medium">Kaució (fizettünk / kaptunk)</th>
                <th className="px-2 py-2 text-right font-medium">Különbözet / hó</th>
                <th className="px-2 py-2 text-right font-medium">Fő / férőhely</th>
                <th className="px-4 py-2 font-medium">Bérlés vége</th>
              </tr>
            </thead>
            <tbody>
              {lodgings.map((l) => {
                const leaseM = monthlyEquivalent(l.lease_fee, l.lease_frequency);
                const subM = monthlyEquivalent(l.sublease_fee, l.sublease_frequency);
                const margin = leaseM !== null && subM !== null ? subM - leaseM : null;
                const href = `/dashboard/finance/lodgings/${l.id}`;
                return (
                  <tr key={l.id} className="border-b border-border-subtle align-top last:border-0 hover:bg-background/60">
                    <td className="max-w-[280px] px-4 py-2">
                      <Link href={href} className="font-medium text-foreground hover:underline">
                        {l.address}
                      </Link>
                      <div className="text-xs text-muted">
                        {[l.company_id && companyName.get(l.company_id), l.area_sqm && `${Number(l.area_sqm)} m²`].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div>{party(l.landlord_id)?.name ?? <span className="text-muted-subtle">—</span>}</div>
                      <div className="text-xs tabular-nums text-muted">{leaseM !== null ? formatMoney(leaseM) : ""}</div>
                    </td>
                    <td className="px-2 py-2 text-xs tabular-nums text-muted">
                      <div>{party(l.landlord_id)?.tax_number ?? <span className="text-warning">{l.landlord_id ? "nincs adóaz." : ""}</span>}</div>
                      <div className="select-all">{party(l.landlord_id)?.bank_account ?? ""}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div>{party(l.tenant_id)?.name ?? <span className="text-xs text-warning">nincs kiadva</span>}</div>
                      <div className="text-xs tabular-nums text-muted">{subM !== null ? formatMoney(subM) : ""}</div>
                    </td>
                    <td className="px-2 py-2 text-xs tabular-nums text-muted">{party(l.tenant_id)?.tax_number ?? ""}</td>
                    <td className="px-2 py-2 text-right text-xs tabular-nums">
                      <div>{l.lease_deposit !== null ? formatMoney(Number(l.lease_deposit)) : "—"}</div>
                      <div className="text-muted">{l.sublease_deposit !== null ? formatMoney(Number(l.sublease_deposit)) : "—"}</div>
                    </td>
                    <td className={`px-2 py-2 text-right font-medium tabular-nums ${margin === null ? "text-muted-subtle" : margin < 0 ? "text-danger" : "text-success"}`}>
                      {margin === null ? "—" : formatMoney(margin)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.occupants ?? "—"} / {l.capacity ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <EndBadge end={l.lease_end} today={today} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border text-sm font-semibold tabular-nums">
                <td className="px-4 py-2 text-muted">{lodgings.length} szállás</td>
                <td className="px-2 py-2">{formatMoney(totalLease)}</td>
                <td />
                <td className="px-2 py-2">{formatMoney(totalSub)}</td>
                <td />
                <td />
                <td className={`px-2 py-2 text-right ${totalSub - totalLease < 0 ? "text-danger" : "text-success"}`}>{formatMoney(totalSub - totalLease)}</td>
                <td className="px-2 py-2 text-right">
                  {totalOccupants} / {totalCapacity}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}

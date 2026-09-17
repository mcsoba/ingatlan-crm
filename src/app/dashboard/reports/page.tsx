import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { BarListChart } from "@/components/ui/charts";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { SOURCE_LABELS } from "@/app/dashboard/contacts/constants";

type DealRow = {
  owner_id: string | null;
  contact_id: string;
  stage_id: string;
  deal_amount: number | null;
  commission_rate: number | null;
  status: string;
};

function formatHuf(amount: number): string {
  return `${Math.round(amount).toLocaleString("hu-HU")} Ft`;
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [{ data: deals }, { data: stages }, { data: members }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("deals")
        .select("owner_id, contact_id, stage_id, deal_amount, commission_rate, status"),
      supabase.from("pipeline_stages").select("id, name, position").order("position"),
      supabase.from("profiles").select("id, full_name").order("created_at"),
      supabase.from("contacts").select("id, source"),
    ]);

  const lastStageId = stages && stages.length > 0 ? stages[stages.length - 1].id : null;

  const emailById = new Map<string, string>();
  if (members && members.length > 0) {
    const admin = createAdminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
    const memberIds = new Set(members.map((m) => m.id));
    for (const user of usersPage?.users ?? []) {
      if (memberIds.has(user.id)) emailById.set(user.id, user.email ?? "");
    }
  }

  type Stats = { total: number; closed: number; lost: number; commission: number };
  const emptyStats = (): Stats => ({ total: 0, closed: 0, lost: 0, commission: 0 });
  const statsByOwner = new Map<string, Stats>();
  const unassigned: Stats = emptyStats();

  for (const deal of (deals ?? []) as DealRow[]) {
    const bucket = deal.owner_id
      ? (statsByOwner.get(deal.owner_id) ?? emptyStats())
      : unassigned;

    bucket.total += 1;
    if (deal.status === "lost") {
      bucket.lost += 1;
    } else {
      if (lastStageId && deal.stage_id === lastStageId) bucket.closed += 1;
      if (deal.deal_amount != null && deal.commission_rate != null) {
        bucket.commission += (deal.deal_amount * deal.commission_rate) / 100;
      }
    }

    if (deal.owner_id) statsByOwner.set(deal.owner_id, bucket);
  }

  const rows = (members ?? []).map((member) => ({
    id: member.id,
    name: member.full_name || emailById.get(member.id) || "Ismeretlen",
    stats: statsByOwner.get(member.id) ?? emptyStats(),
  }));

  if (unassigned.total > 0) {
    rows.push({ id: "unassigned", name: "Nincs hozzárendelve", stats: unassigned });
  }

  const commissionChartData = rows
    .filter((row) => row.stats.commission > 0)
    .map((row) => ({ label: row.name, count: Math.round(row.stats.commission) }));

  // Konverzió forrásonként: melyik kontakt-forrásból (weboldal/ajánlás/stb.)
  // lesz a legtöbb LEZÁRT deal, nem csak a legtöbb kontakt -- ez segít
  // eldönteni, hova érdemes marketing-erőforrást fordítani.
  const closedContactIds = new Set(
    (deals ?? [])
      .filter((d) => d.status !== "lost" && lastStageId && d.stage_id === lastStageId)
      .map((d) => d.contact_id),
  );

  type SourceStats = { total: number; closed: number };
  const statsBySource = new Map<string, SourceStats>();
  for (const contact of contacts ?? []) {
    const bucket = statsBySource.get(contact.source) ?? { total: 0, closed: 0 };
    bucket.total += 1;
    if (closedContactIds.has(contact.id)) bucket.closed += 1;
    statsBySource.set(contact.source, bucket);
  }

  const sourceRows = Array.from(statsBySource.entries())
    .map(([source, stats]) => ({
      source,
      label: SOURCE_LABELS[source] ?? source,
      ...stats,
      rate: Math.round((stats.closed / stats.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  const sourceChartData = sourceRows.map((row) => ({ label: row.label, count: row.rate }));

  // Súlyozott pipeline-előrejelzés: minél közelebb van egy deal a záró
  // szakaszhoz, annál valószínűbb, hogy megvalósul a bevétele. Egyszerű,
  // a szakaszok POZÍCIÓJA alapján lineárisan skálázott heurisztika (nem
  // konfigurálható v1-ben) — a záró szakasz mindig 100%, tehát egy oda
  // ért (de még nem lost-ra jelölt) deal a teljes összegével számít.
  const orderedStages = stages ?? [];
  const probabilityByStage = new Map(
    orderedStages.map((stage, index) => [
      stage.id,
      Math.round(((index + 1) / orderedStages.length) * 100),
    ]),
  );

  const forecastByStage = new Map(
    orderedStages.map((stage) => [stage.id, { raw: 0, weighted: 0 }]),
  );
  let forecastRawTotal = 0;
  let forecastWeightedTotal = 0;

  for (const deal of (deals ?? []) as DealRow[]) {
    if (deal.status === "lost" || deal.deal_amount == null) continue;
    const probability = probabilityByStage.get(deal.stage_id) ?? 0;
    const weighted = (deal.deal_amount * probability) / 100;
    forecastRawTotal += deal.deal_amount;
    forecastWeightedTotal += weighted;
    const bucket = forecastByStage.get(deal.stage_id);
    if (bucket) {
      bucket.raw += deal.deal_amount;
      bucket.weighted += weighted;
    }
  }

  const forecastRows = orderedStages
    .map((stage) => ({
      stage,
      probability: probabilityByStage.get(stage.id) ?? 0,
      ...(forecastByStage.get(stage.id) ?? { raw: 0, weighted: 0 }),
    }))
    .filter((row) => row.raw > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Riportok"
        description="Csapat-teljesítmény a pipeline dealek alapján."
      />

      {forecastRows.length > 0 && (
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            Súlyozott pipeline-előrejelzés
            <HelpTooltip text="Minden nyitott deal összegét megszorozza a szakaszához tartozó, a szakasz pozíciója alapján becsült záródási valószínűséggel (a záró szakasz 100%). Ez egy egyszerű heurisztika, nem garantált bevétel." />
          </div>
          <p className="mb-3 text-xs text-muted">
            A nyitott dealek nyers összege a szakaszhoz tartozó záródási eséllyel súlyozva.
          </p>
          <div className="mb-4 flex flex-wrap gap-6">
            <div>
              <div className="text-2xl font-semibold tracking-tight text-foreground">
                {formatHuf(forecastWeightedTotal)}
              </div>
              <div className="text-sm text-muted">Várható bevétel</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tracking-tight text-muted-subtle">
                {formatHuf(forecastRawTotal)}
              </div>
              <div className="text-sm text-muted">Nyers pipeline-összeg</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {forecastRows.map((row) => (
              <div key={row.stage.id} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate text-foreground">{row.stage.name}</span>
                <span className="w-10 shrink-0 text-xs text-muted-subtle">{row.probability}%</span>
                <span className="flex-1 text-muted">{formatHuf(row.raw)}</span>
                <span className="font-medium text-foreground">{formatHuf(row.weighted)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {commissionChartData.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-foreground">
            Jutalék ügynökönként (Ft)
          </div>
          <BarListChart items={commissionChartData} />
        </Card>
      )}

      {sourceRows.length > 0 && (
        <Card className="p-5">
          <div className="mb-1 text-sm font-semibold text-foreground">
            Konverzió lead-forrásonként
          </div>
          <p className="mb-3 text-xs text-muted">
            A kontaktok hány százaléka jutott el lezárt dealig, forrásonként.
          </p>
          <BarListChart items={sourceChartData} format={(n) => `${n}%`} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Ügynök</th>
                <th className="px-4 py-3 font-medium">Összes deal</th>
                <th className="px-4 py-3 font-medium">Lezárt</th>
                <th className="px-4 py-3 font-medium">Elveszett</th>
                <th className="px-4 py-3 font-medium">Összes jutalék</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-3.5 w-3.5 text-muted-subtle" strokeWidth={1.75} />
                      <span className="font-medium text-foreground">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.stats.total}</td>
                  <td className="px-4 py-3 text-muted">{row.stats.closed}</td>
                  <td className="px-4 py-3 text-muted">{row.stats.lost}</td>
                  <td className="px-4 py-3 text-muted">
                    {row.stats.commission > 0
                      ? `${row.stats.commission.toLocaleString("hu-HU", { maximumFractionDigits: 0 })} Ft`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

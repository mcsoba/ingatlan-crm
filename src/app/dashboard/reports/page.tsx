import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { BarListChart } from "@/components/ui/charts";

type DealRow = {
  owner_id: string | null;
  stage_id: string;
  deal_amount: number | null;
  commission_rate: number | null;
};

export default async function ReportsPage() {
  const supabase = await createClient();

  const [{ data: deals }, { data: stages }, { data: members }] =
    await Promise.all([
      supabase
        .from("deals")
        .select("owner_id, stage_id, deal_amount, commission_rate"),
      supabase.from("pipeline_stages").select("id, name, position").order("position"),
      supabase.from("profiles").select("id, full_name").order("created_at"),
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

  type Stats = { total: number; closed: number; commission: number };
  const statsByOwner = new Map<string, Stats>();
  const unassigned: Stats = { total: 0, closed: 0, commission: 0 };

  for (const deal of (deals ?? []) as DealRow[]) {
    const bucket = deal.owner_id
      ? (statsByOwner.get(deal.owner_id) ?? { total: 0, closed: 0, commission: 0 })
      : unassigned;

    bucket.total += 1;
    if (lastStageId && deal.stage_id === lastStageId) bucket.closed += 1;
    if (deal.deal_amount != null && deal.commission_rate != null) {
      bucket.commission += (deal.deal_amount * deal.commission_rate) / 100;
    }

    if (deal.owner_id) statsByOwner.set(deal.owner_id, bucket);
  }

  const rows = (members ?? []).map((member) => ({
    id: member.id,
    name: member.full_name || emailById.get(member.id) || "Ismeretlen",
    stats: statsByOwner.get(member.id) ?? { total: 0, closed: 0, commission: 0 },
  }));

  if (unassigned.total > 0) {
    rows.push({ id: "unassigned", name: "Nincs hozzárendelve", stats: unassigned });
  }

  const commissionChartData = rows
    .filter((row) => row.stats.commission > 0)
    .map((row) => ({ label: row.name, count: Math.round(row.stats.commission) }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Riportok"
        description="Csapat-teljesítmény a pipeline dealek alapján."
      />

      {commissionChartData.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-foreground">
            Jutalék ügynökönként (Ft)
          </div>
          <BarListChart items={commissionChartData} />
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

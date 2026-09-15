import Link from "next/link";
import { Plus, Settings2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type DealCard } from "./board";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

// The Supabase client infers embedded-resource joins as arrays without
// generated Database types; contact_id/property_id are single foreign
// keys, so each deal actually embeds at most one row of each at runtime.
type DealRow = {
  id: string;
  stage_id: string;
  updated_at: string;
  deal_amount: number | null;
  status: string;
  lost_reason: string | null;
  lost_at: string | null;
  contacts: { name: string } | null;
  properties: { address: string } | null;
};

const STALE_AFTER_DAYS = 14;

export default async function PipelinePage() {
  const supabase = await createClient();

  const [{ data: stages, error: stagesError }, { data: deals, error: dealsError }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .order("position"),
      supabase
        .from("deals")
        .select(
          "id, stage_id, updated_at, deal_amount, status, lost_reason, lost_at, contacts(name), properties(address)",
        )
        .order("created_at", { ascending: false }),
    ]);

  if (stagesError) throw stagesError;
  if (dealsError) throw dealsError;

  const lastStagePosition = Math.max(...(stages ?? []).map((s) => s.position), 0);
  const stagePositionById = new Map((stages ?? []).map((s) => [s.id, s.position]));
  const now = new Date().getTime();

  const allDeals = deals as unknown as DealRow[];

  const dealCards: DealCard[] = allDeals
    .filter((deal) => deal.status !== "lost")
    .map((deal) => {
      const daysSinceUpdate = Math.floor(
        (now - new Date(deal.updated_at).getTime()) / (24 * 60 * 60 * 1000),
      );
      const isClosed = stagePositionById.get(deal.stage_id) === lastStagePosition;

      return {
        id: deal.id,
        stageId: deal.stage_id,
        contactName: deal.contacts?.name ?? "Ismeretlen kontakt",
        propertyAddress: deal.properties?.address ?? null,
        dealAmount: deal.deal_amount,
        isStale: !isClosed && daysSinceUpdate >= STALE_AFTER_DAYS,
        daysSinceUpdate,
      };
    });

  const lostDeals = allDeals
    .filter((deal) => deal.status === "lost")
    .sort((a, b) => (b.lost_at ?? "").localeCompare(a.lost_at ?? ""))
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pipeline"
        description="Húzd a kártyákat a szakaszok között."
        helpText="A pipeline minden folyamatban lévő üzletet (deal-t) mutat kártyaként. Ahogy egy érdeklődő közelebb kerül a vásárláshoz/eladáshoz, húzd a kártyáját a következő szakaszba — így mindig látod, hol tart minden ügy."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/pipeline/stages"
              className={buttonVariants("secondary")}
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.75} />
              Szakaszok
            </Link>
            <Link
              href="/dashboard/pipeline/new"
              className={buttonVariants("primary")}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Új deal
            </Link>
          </div>
        }
      />

      <PipelineBoard stages={stages} deals={dealCards} />

      {lostDeals.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <XCircle className="h-4 w-4 text-danger" strokeWidth={1.75} />
            Elveszett dealek
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Kontakt</th>
                    <th className="px-4 py-3 font-medium">Ingatlan</th>
                    <th className="px-4 py-3 font-medium">Indok</th>
                    <th className="px-4 py-3 font-medium">Dátum</th>
                  </tr>
                </thead>
                <tbody>
                  {lostDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-background"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/pipeline/${deal.id}`}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {deal.contacts?.name ?? "Ismeretlen kontakt"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {deal.properties?.address ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {deal.lost_reason ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {deal.lost_at
                          ? new Date(deal.lost_at).toLocaleDateString("hu-HU")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

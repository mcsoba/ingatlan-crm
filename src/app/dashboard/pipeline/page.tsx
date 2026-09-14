import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type DealCard } from "./board";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";

// The Supabase client infers embedded-resource joins as arrays without
// generated Database types; contact_id/property_id are single foreign
// keys, so each deal actually embeds at most one row of each at runtime.
type DealRow = {
  id: string;
  stage_id: string;
  contacts: { name: string } | null;
  properties: { address: string } | null;
};

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
        .select("id, stage_id, contacts(name), properties(address)")
        .order("created_at", { ascending: false }),
    ]);

  if (stagesError) throw stagesError;
  if (dealsError) throw dealsError;

  const dealCards: DealCard[] = (deals as unknown as DealRow[]).map((deal) => ({
    id: deal.id,
    stageId: deal.stage_id,
    contactName: deal.contacts?.name ?? "Ismeretlen kontakt",
    propertyAddress: deal.properties?.address ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pipeline"
        description="Húzd a kártyákat a szakaszok között."
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
    </div>
  );
}

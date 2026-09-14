import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type DealCard } from "./board";

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
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/pipeline/stages"
            className="text-sm text-neutral-500 hover:underline"
          >
            Szakaszok szerkesztése
          </Link>
          <Link
            href="/dashboard/pipeline/new"
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Új deal
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <PipelineBoard stages={stages} deals={dealCards} />
      </div>
    </div>
  );
}

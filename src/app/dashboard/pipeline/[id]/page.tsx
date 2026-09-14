import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteDeal, updateDealNotes, updateDealStage } from "../actions";
import { DealFollowUpPanel } from "./follow-up-panel";
import { ActivityPanel } from "../../activities/activity-panel";

type DealDetailRow = {
  id: string;
  stage_id: string;
  notes: string | null;
  contacts: { id: string; name: string; email: string | null; phone: string | null } | null;
  properties: { id: string; address: string; price: number | null } | null;
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: deal }, { data: stages }, { data: activities, error: activitiesError }] =
    await Promise.all([
      supabase
        .from("deals")
        .select(
          "id, stage_id, notes, contacts(id, name, email, phone), properties(id, address, price)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("pipeline_stages").select("id, name").order("position"),
      supabase
        .from("activities")
        .select("id, type, content, due_at, done")
        .eq("deal_id", id)
        .order("done")
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

  if (activitiesError) throw activitiesError;
  if (!deal) notFound();

  const dealRow = deal as unknown as DealDetailRow;
  const contact = dealRow.contacts;
  const property = dealRow.properties;
  const stageName = stages?.find((s) => s.id === dealRow.stage_id)?.name ?? "—";
  const updateStageWithId = updateDealStage.bind(null, dealRow.id);
  const updateNotesWithId = updateDealNotes.bind(null, dealRow.id);

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {contact?.name ?? "Ismeretlen kontakt"}
        </h1>
        <Link
          href="/dashboard/pipeline"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Pipeline
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="rounded border border-neutral-200 p-3 text-sm">
          <div className="font-medium">Kontakt</div>
          {contact ? (
            <>
              <div>
                <Link
                  href={`/dashboard/contacts/${contact.id}/edit`}
                  className="hover:underline"
                >
                  {contact.name}
                </Link>
              </div>
              <div className="text-neutral-600">
                {contact.email || contact.phone || "—"}
              </div>
            </>
          ) : (
            <div className="text-neutral-500">Nincs kontakt</div>
          )}
        </div>

        <div className="rounded border border-neutral-200 p-3 text-sm">
          <div className="font-medium">Ingatlan</div>
          {property ? (
            <Link
              href={`/dashboard/properties/${property.id}/edit`}
              className="hover:underline"
            >
              {property.address}
              {property.price
                ? ` · ${property.price.toLocaleString("hu-HU")} Ft`
                : ""}
            </Link>
          ) : (
            <div className="text-neutral-500">Nincs kapcsolódó ingatlan</div>
          )}
        </div>

        <form action={updateStageWithId} className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Szakasz</span>
          <div className="flex gap-2">
            <select
              name="stage_id"
              defaultValue={dealRow.stage_id}
              className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {stages?.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
            >
              Mentés
            </button>
          </div>
        </form>

        <form action={updateNotesWithId} className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Jegyzet</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={dealRow.notes ?? ""}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Jegyzet mentése
          </button>
        </form>

        <DealFollowUpPanel
          contactName={contact?.name ?? ""}
          stageName={stageName}
          propertyAddress={property?.address ?? null}
          notes={dealRow.notes ?? ""}
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Aktivitások</span>
          <ActivityPanel
            dealId={dealRow.id}
            activities={activities ?? []}
            redirectTo={`/dashboard/pipeline/${dealRow.id}`}
          />
        </div>

        <form action={deleteDeal} className="border-t border-neutral-200 pt-4">
          <input type="hidden" name="id" value={dealRow.id} />
          <button type="submit" className="text-sm text-red-600 hover:underline">
            Deal törlése
          </button>
        </form>
      </div>
    </div>
  );
}

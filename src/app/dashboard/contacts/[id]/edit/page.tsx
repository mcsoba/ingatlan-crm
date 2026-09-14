import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateContact } from "../../actions";
import { ContactForm } from "../../contact-form";
import { ActivityPanel } from "../../../activities/activity-panel";
import { PropertyMatchPanel } from "../../property-match-panel";

type ContactDealRow = {
  id: string;
  stage_id: string;
  properties: { address: string } | null;
};

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: contact },
    { data: deals, error: dealsError },
    { data: stages },
    { data: activities, error: activitiesError },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, email, phone, source, status, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("deals")
      .select("id, stage_id, properties(address)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("pipeline_stages").select("id, name"),
    supabase
      .from("activities")
      .select("id, type, content, due_at, done")
      .eq("contact_id", id)
      .order("done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (dealsError) throw dealsError;
  if (activitiesError) throw activitiesError;
  if (!contact) notFound();

  const updateWithId = updateContact.bind(null, contact.id);
  const stageNames = new Map((stages ?? []).map((s) => [s.id, s.name]));
  const contactDeals = (deals ?? []) as unknown as ContactDealRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Kontakt szerkesztése</h1>
      <div className="mt-6">
        <ContactForm
          action={updateWithId}
          defaultValues={contact}
          submitLabel="Mentés"
        />
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="text-sm font-medium text-neutral-700">
          Illő ingatlanok
        </h2>
        <div className="mt-2">
          <PropertyMatchPanel contactId={contact.id} />
        </div>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="text-sm font-medium text-neutral-700">Dealek</h2>
        {contactDeals.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Ehhez a kontakthoz még nincs deal.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {contactDeals.map((deal) => (
              <Link
                key={deal.id}
                href={`/dashboard/pipeline/${deal.id}`}
                className="rounded border border-neutral-200 p-2 text-sm hover:bg-neutral-50"
              >
                <div>{stageNames.get(deal.stage_id) ?? "—"}</div>
                {deal.properties && (
                  <div className="text-neutral-500">
                    {deal.properties.address}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="text-sm font-medium text-neutral-700">Aktivitások</h2>
        <div className="mt-2">
          <ActivityPanel
            contactId={contact.id}
            activities={activities ?? []}
            redirectTo={`/dashboard/contacts/${contact.id}/edit`}
          />
        </div>
      </div>
    </div>
  );
}

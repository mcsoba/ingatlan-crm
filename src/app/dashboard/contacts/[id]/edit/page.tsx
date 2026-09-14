import Link from "next/link";
import { notFound } from "next/navigation";
import { Kanban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateContact } from "../../actions";
import { ContactForm } from "../../contact-form";
import { ActivityPanel } from "../../../activities/activity-panel";
import { PropertyMatchPanel } from "../../property-match-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { sectionLabelClass } from "@/components/ui/styles";

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={contact.name}
        description="Kontakt szerkesztése"
        action={
          <Link
            href="/dashboard/contacts"
            className="text-sm text-muted hover:text-accent"
          >
            ← Kontaktok
          </Link>
        }
      />

      <ContactForm
        action={updateWithId}
        defaultValues={contact}
        submitLabel="Mentés"
      />

      <div className="max-w-md">
        <h2 className={`mb-2 ${sectionLabelClass}`}>Illő ingatlanok</h2>
        <PropertyMatchPanel contactId={contact.id} />
      </div>

      <div className="max-w-md">
        <h2 className={`mb-2 ${sectionLabelClass}`}>Dealek</h2>
        {contactDeals.length === 0 ? (
          <p className="text-sm text-muted">
            Ehhez a kontakthoz még nincs deal.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {contactDeals.map((deal) => (
              <Link key={deal.id} href={`/dashboard/pipeline/${deal.id}`}>
                <Card className="flex items-start gap-2.5 p-3 text-sm hover:border-accent/40">
                  <Kanban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                  <div>
                    <div className="font-medium text-foreground">
                      {stageNames.get(deal.stage_id) ?? "—"}
                    </div>
                    {deal.properties && (
                      <div className="text-muted">{deal.properties.address}</div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-md">
        <h2 className={`mb-2 ${sectionLabelClass}`}>Aktivitások</h2>
        <ActivityPanel
          contactId={contact.id}
          activities={activities ?? []}
          redirectTo={`/dashboard/contacts/${contact.id}/edit`}
        />
      </div>
    </div>
  );
}

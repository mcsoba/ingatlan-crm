import Link from "next/link";
import { notFound } from "next/navigation";
import { Kanban, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { listTeamMembers } from "@/lib/team";
import { updateContact } from "../../actions";
import { ContactForm } from "../../contact-form";
import { ContactCommsPanel } from "../../contact-comms-panel";
import { ActivityPanel } from "../../../activities/activity-panel";
import { PropertyMatchPanel } from "../../property-match-panel";
import { LeadScorePanel } from "../../lead-score-panel";
import { CampaignPanel } from "../../campaign-panel";
import { AttachmentsPanel } from "../../../attachments/attachments-panel";
import { TagPicker } from "../../../tags/tag-picker";
import { listAgencyTags } from "../../../tags/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { STATUS_LABELS } from "../../constants";
import { sectionLabelClass } from "@/components/ui/styles";
import { SIMPLE_MODE } from "@/lib/edition";

type ContactDealRow = {
  id: string;
  stage_id: string;
  properties: { address: string } | null;
};

// Az első fül a napi munka (teendők, üzletek) — az adatok szerkesztése ritkább
const TABS = [
  { id: "kapcsolodo", label: "Teendők és üzletek" },
  { id: "adatlap", label: "Adatok" },
  { id: "kommunikacio", label: "E-mail és SMS" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function EditContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: TabId = TABS.some((t) => t.id === tab)
    ? (tab as TabId)
    : "kapcsolodo";
  const supabase = await createClient();

  const [
    { data: contact },
    { data: deals, error: dealsError },
    { data: stages },
    { data: activities, error: activitiesError },
    { data: contactTagRows },
    allTags,
    teamMembers,
    { profile },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, name, email, phone, source, status, notes, lead_score, lead_score_reason, owner_id",
      )
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
      .select("id, type, content, due_at, done, email_body, sequence_id")
      .eq("contact_id", id)
      .order("done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("contact_tags").select("tag_id").eq("contact_id", id),
    listAgencyTags(),
    listTeamMembers(),
    ensureCurrentUserProfile(),
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
        description={[
          STATUS_LABELS[contact.status] ?? contact.status,
          `Felelős: ${teamMembers.find((m) => m.id === contact.owner_id)?.name ?? "nincs kijelölve"}`,
        ].join(" · ")}
        action={
          <Link
            href="/dashboard/contacts"
            className="text-sm text-muted hover:text-accent"
          >
            ← Kontaktok
          </Link>
        }
      />

      {(contact.phone || contact.email) && (
        <div className="flex flex-wrap gap-2">
          {contact.phone && (
            <a href={`tel:${contact.phone.replace(/[^d+]/g, "")}`} className={buttonVariants("secondary", "sm")}>
              <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className={buttonVariants("secondary", "sm")}>
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              {contact.email}
            </a>
          )}
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/contacts/${contact.id}/edit?tab=${t.id}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "adatlap" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <ContactForm
              action={updateWithId}
              contactId={contact.id}
              defaultValues={contact}
              submitLabel="Mentés"
            />
          </div>
          <aside className="flex min-w-0 flex-col gap-4">
            {!SIMPLE_MODE && (
            <TagPicker
              entityType="contact"
              entityId={contact.id}
              allTags={allTags}
              initialTagIds={(contactTagRows ?? []).map((r) => r.tag_id)}
            />
            )}
            <LeadScorePanel
              contactId={contact.id}
              initialScore={contact.lead_score}
              initialReason={contact.lead_score_reason}
            />
          </aside>
        </div>
      )}

      {activeTab === "kommunikacio" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <ContactCommsPanel
            contactId={contact.id}
            name={contact.name}
            email={contact.email}
            phone={contact.phone}
            source={contact.source}
            status={contact.status}
            notes={contact.notes}
          />

          {!SIMPLE_MODE && (
          <aside className="min-w-0">
            <CampaignPanel
              contactId={contact.id}
              hasEmail={Boolean(contact.email)}
            />
          </aside>
          )}
        </div>
      )}

      {activeTab === "kapcsolodo" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            <div>
              <h2 className={`mb-2 ${sectionLabelClass}`}>Aktivitások</h2>
              <ActivityPanel
                contactId={contact.id}
                activities={activities ?? []}
                redirectTo={`/dashboard/contacts/${contact.id}/edit?tab=kapcsolodo`}
                members={teamMembers}
                currentUserId={profile.id}
              />
            </div>

            <div>
              <h2 className={`mb-2 ${sectionLabelClass}`}>Csatolt fájlok</h2>
              <AttachmentsPanel contactId={contact.id} />
            </div>
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
              <h2 className={sectionLabelClass}>Üzletek</h2>
              <Link
                href={`/dashboard/pipeline/new?contact=${contact.id}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                + Új üzlet
              </Link>
            </div>
              {contactDeals.length === 0 ? (
                <p className="text-sm text-muted">
                  Ehhez a kontakthoz még nincs üzlet.
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
                            <div className="text-muted">
                              {deal.properties.address}
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className={`mb-2 ${sectionLabelClass}`}>Illő ingatlanok</h2>
              <PropertyMatchPanel contactId={contact.id} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

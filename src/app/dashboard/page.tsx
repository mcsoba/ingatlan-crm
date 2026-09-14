import Link from "next/link";
import { Users, Building2, Kanban, ListChecks, Circle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type ChecklistItem = { label: string; done: boolean; href: string };

type UpcomingActivity = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  contacts: { id: string; name: string } | null;
  deals: { id: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

export default async function DashboardPage() {
  const { user, profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [
    { count: contactCount },
    { count: propertyCount },
    { count: dealCount },
    { count: memberCount },
    { data: upcoming, error: upcomingError },
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("deals").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("activities")
      .select("id, type, content, due_at, contacts(id, name), deals(id)")
      .eq("done", false)
      .neq("type", "checklist")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  if (upcomingError) throw upcomingError;
  const upcomingActivities = (upcoming ?? []) as unknown as UpcomingActivity[];

  const hasIntegration = Boolean(
    process.env.STRIPE_SECRET_KEY || process.env.RESEND_API_KEY || process.env.TWILIO_ACCOUNT_SID,
  );
  const checklist: ChecklistItem[] = [
    { label: "Adj hozzá egy kontaktot", done: (contactCount ?? 0) > 0, href: "/dashboard/contacts/new" },
    { label: "Adj hozzá egy ingatlant", done: (propertyCount ?? 0) > 0, href: "/dashboard/properties/new" },
    { label: "Hozz létre egy dealt a pipeline-on", done: (dealCount ?? 0) > 0, href: "/dashboard/pipeline/new" },
    { label: "Hívj meg egy csapattagot", done: (memberCount ?? 0) > 1, href: "/dashboard/team" },
    {
      label: "Kapcsolj be legalább egy integrációt (email, SMS vagy fizetés)",
      done: hasIntegration,
      href: "/dashboard/settings",
    },
  ];
  const checklistDone = checklist.every((item) => item.done);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Üdv, ${user.email?.split("@")[0]}!`}
        description={`${profile.agencies.name} · ${profile.agencies.plan_tier === "pro" ? "Pro csomag" : "Ingyenes csomag"}`}
      />

      {!checklistDone && (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <div className="text-sm font-medium text-foreground">Első lépések</div>
            <p className="mt-0.5 text-xs text-muted">
              Ennyi maradt, hogy az iroda teljesen fel legyen véve a rendszerbe.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {checklist.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2 text-sm ${item.done ? "text-muted-subtle line-through" : "text-foreground hover:text-accent"}`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-subtle" />
                )}
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          href="/dashboard/contacts"
          label="Kontakt"
          value={contactCount ?? 0}
          icon={Users}
        />
        <StatCard
          href="/dashboard/properties"
          label="Ingatlan"
          value={propertyCount ?? 0}
          icon={Building2}
        />
        <StatCard
          href="/dashboard/pipeline"
          label="Deal"
          value={dealCount ?? 0}
          icon={Kanban}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Közelgő teendők</h2>
          <Link href="/dashboard/calendar" className="text-xs text-muted hover:text-accent">
            Teljes naptár →
          </Link>
        </div>
        {upcomingActivities.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Nincs nyitott teendő"
            description="Amint felviszel egy hívást, megtekintést vagy emlékeztetőt, itt fog megjelenni."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingActivities.map((activity) => {
              const href = activity.deals
                ? `/dashboard/pipeline/${activity.deals.id}`
                : activity.contacts
                  ? `/dashboard/contacts/${activity.contacts.id}/edit`
                  : null;

              const body = (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">
                      {activity.content}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Badge variant="neutral">
                        {TYPE_LABELS[activity.type] ?? activity.type}
                      </Badge>
                      {activity.contacts && <span>{activity.contacts.name}</span>}
                      {activity.due_at && (
                        <span>
                          {new Date(activity.due_at).toLocaleDateString("hu-HU")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              return (
                <Card key={activity.id} className="p-3">
                  {href ? (
                    <Link href={href} className="block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

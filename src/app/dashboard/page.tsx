import Link from "next/link";
import { Users, Building2, Kanban, Circle, CheckCircle2, Flame, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { BarListChart, TrendBarChart } from "@/components/ui/charts";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/app/dashboard/contacts/constants";
import { TodayPanel } from "./today-panel";
import { PRIVATE_EDITION, planLabel } from "@/lib/edition";

type ChecklistItem = { label: string; done: boolean; href: string };

export default async function DashboardPage() {
  const { user, profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const trendStart = new Date();
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - 13);

  const [
    { count: contactCount },
    { count: propertyCount },
    { count: dealCount },
    { count: memberCount },
    { data: stages },
    { data: dealStages },
    { data: recentContacts },
    { data: hotLeads },
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("deals").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("pipeline_stages").select("id, name, position").order("position"),
    supabase.from("deals").select("stage_id"),
    supabase
      .from("contacts")
      .select("created_at")
      .gte("created_at", trendStart.toISOString()),
    supabase
      .from("contacts")
      .select("id, name, status, lead_score")
      .gte("lead_score", 40)
      .neq("status", "inactive")
      .order("lead_score", { ascending: false })
      .limit(5),
  ]);


  const dealCountByStage = new Map<string, number>();
  for (const deal of dealStages ?? []) {
    dealCountByStage.set(deal.stage_id, (dealCountByStage.get(deal.stage_id) ?? 0) + 1);
  }
  const funnelData = (stages ?? []).map((stage) => ({
    label: stage.name,
    count: dealCountByStage.get(stage.id) ?? 0,
  }));

  const leadsByDay = new Map<string, number>();
  for (const contact of recentContacts ?? []) {
    const day = contact.created_at.slice(0, 10);
    leadsByDay.set(day, (leadsByDay.get(day) ?? 0) + 1);
  }
  const trendData = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(trendStart);
    day.setDate(day.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    return {
      label: day.toLocaleDateString("hu-HU", { month: "2-digit", day: "2-digit" }),
      count: leadsByDay.get(key) ?? 0,
    };
  });

  const hasIntegration = Boolean(
    (!PRIVATE_EDITION && process.env.STRIPE_SECRET_KEY) || process.env.RESEND_API_KEY || process.env.TWILIO_ACCOUNT_SID,
  );
  const checklist: ChecklistItem[] = [
    { label: "Adj hozzá egy kontaktot", done: (contactCount ?? 0) > 0, href: "/dashboard/contacts/new" },
    { label: "Adj hozzá egy ingatlant", done: (propertyCount ?? 0) > 0, href: "/dashboard/properties/new" },
    { label: "Hozz létre egy üzletet az Üzletek táblán", done: (dealCount ?? 0) > 0, href: "/dashboard/pipeline/new" },
    { label: "Hívj meg egy csapattagot", done: (memberCount ?? 0) > 1, href: "/dashboard/team" },
    {
      label: PRIVATE_EDITION
        ? "Kapcsolj be legalább egy integrációt (email vagy SMS)"
        : "Kapcsolj be legalább egy integrációt (email, SMS vagy fizetés)",
      done: hasIntegration,
      href: "/dashboard/settings",
    },
  ];
  const checklistDone = checklist.every((item) => item.done);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Üdv, ${profile.full_name?.split(" ")[0] || user.email?.split("@")[0]}!`}
        description={[profile.agencies.name, planLabel(profile.agencies.plan_tier)].filter(Boolean).join(" · ")}
        action={
          <Link href="/dashboard/guide" className="flex items-center gap-1.5 text-sm text-muted hover:text-accent">
            <BookOpen className="h-4 w-4" strokeWidth={1.75} />
            Használati útmutató
          </Link>
        }
      />

      {/* Átadott (privát) telepítésben az irodát mi állítjuk be, nincs bevezető lista */}
      {!PRIVATE_EDITION && !checklistDone && (
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

      <TodayPanel profileId={profile.id} />

      <h2 className="-mb-4 text-base font-semibold text-foreground">Áttekintés</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          label="Üzlet"
          value={dealCount ?? 0}
          icon={Kanban}
        />
      </div>

      {funnelData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">
                Üzletek szakaszonként
              </h2>
              <HelpTooltip text="Hány folyamatban lévő üzlet van jelenleg az egyes szakaszokban. Segít látni, hol torlódnak fel az ügyek." />
            </div>
            <BarListChart items={funnelData} />
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">
                Új érdeklődők (14 nap)
              </h2>
              <HelpTooltip text="Az elmúlt 14 napban naponta hány új kontakt került fel a rendszerbe — akár kézzel, akár a publikus ingatlan-oldal érdeklődő-űrlapjáról." />
            </div>
            <TrendBarChart points={trendData} />
          </Card>
        </div>
      )}

      {hotLeads && hotLeads.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">Forró érdeklődők</h2>
            <HelpTooltip text="Az AI érdeklődő-pontszám alapján legmagasabbra értékelt, még nyitott (nem inaktív) kontaktok — velük érdemes most foglalkozni." />
          </div>
          <div className="flex flex-col gap-2">
            {hotLeads.map((lead) => (
              <Card key={lead.id} className="p-3">
                <Link
                  href={`/dashboard/contacts/${lead.id}/edit`}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Flame className="h-4 w-4 shrink-0 text-warning" />
                    <span className="truncate text-sm text-foreground">{lead.name}</span>
                    <Badge variant={STATUS_VARIANTS[lead.status] ?? "neutral"}>
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </Badge>
                  </div>
                  <Badge variant={lead.lead_score! >= 70 ? "success" : "warning"}>
                    {lead.lead_score}
                  </Badge>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

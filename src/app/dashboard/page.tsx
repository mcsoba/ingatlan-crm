import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

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
    { data: upcoming, error: upcomingError },
  ] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("deals").select("id", { count: "exact", head: true }),
    supabase
      .from("activities")
      .select("id, type, content, due_at, contacts(id, name), deals(id)")
      .eq("done", false)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  if (upcomingError) throw upcomingError;
  const upcomingActivities = (upcoming ?? []) as unknown as UpcomingActivity[];

  return (
    <div>
      <p className="text-neutral-600">
        Bejelentkezve mint {user.email} · szerep: {profile.role} · csomag:{" "}
        {profile.agencies.plan_tier}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Link
          href="/dashboard/contacts"
          className="rounded border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <div className="text-3xl font-semibold">{contactCount ?? 0}</div>
          <div className="text-neutral-600">Kontakt</div>
        </Link>

        <Link
          href="/dashboard/properties"
          className="rounded border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <div className="text-3xl font-semibold">{propertyCount ?? 0}</div>
          <div className="text-neutral-600">Ingatlan</div>
        </Link>

        <Link
          href="/dashboard/pipeline"
          className="rounded border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <div className="text-3xl font-semibold">{dealCount ?? 0}</div>
          <div className="text-neutral-600">Deal</div>
        </Link>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="text-sm font-medium text-neutral-700">
          Közelgő teendők
        </h2>
        {upcomingActivities.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Nincs nyitott teendő.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {upcomingActivities.map((activity) => {
              const href = activity.deals
                ? `/dashboard/pipeline/${activity.deals.id}`
                : activity.contacts
                  ? `/dashboard/contacts/${activity.contacts.id}/edit`
                  : null;
              const body = (
                <>
                  <div className="text-xs text-neutral-500">
                    {TYPE_LABELS[activity.type] ?? activity.type}
                    {activity.due_at &&
                      ` · határidő: ${new Date(activity.due_at).toLocaleDateString("hu-HU")}`}
                    {activity.contacts && ` · ${activity.contacts.name}`}
                  </div>
                  <div className="text-sm">{activity.content}</div>
                </>
              );

              return href ? (
                <Link
                  key={activity.id}
                  href={href}
                  className="rounded border border-neutral-200 p-2 hover:bg-neutral-50"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={activity.id}
                  className="rounded border border-neutral-200 p-2"
                >
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

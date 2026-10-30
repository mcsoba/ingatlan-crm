import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { TasksViewSwitch } from "../tasks/view-switch";

type CalendarActivity = {
  id: string;
  type: string;
  content: string;
  due_at: string;
  done: boolean;
  contacts: { id: string; name: string } | null;
  deals: { id: string } | null;
};

type CalendarLeave = { id: string; start_date: string; end_date: string; profiles: { full_name: string | null } | null };

const WEEKDAY_LABELS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

const TYPE_CHIP_CLASS: Record<string, string> = {
  note: "bg-background text-muted",
  call: "bg-accent-soft text-accent-hover",
  viewing: "bg-success-soft text-success",
  reminder: "bg-warning-soft text-warning",
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1; // 1-12

  const monthStart = new Date(year, month - 1, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - mondayIndex(monthStart));
  const gridDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const gridEnd = gridDays[gridDays.length - 1];

  const queryFrom = new Date(gridStart);
  queryFrom.setDate(queryFrom.getDate() - 1);
  const queryTo = new Date(gridEnd);
  queryTo.setDate(queryTo.getDate() + 2);

  const supabase = await createClient();
  const { data: activities, error } = await supabase
    .from("activities")
    .select("id, type, content, due_at, done, contacts(id, name), deals(id)")
    .not("due_at", "is", null)
    .neq("type", "checklist")
    .gte("due_at", queryFrom.toISOString())
    .lt("due_at", queryTo.toISOString())
    .order("due_at", { ascending: true });

  if (error) throw error;

  // Szabadságok (0041_leave.sql) — ha a tábla még nincs meg, a naptár nélküle működik tovább
  const { data: leaveRows } = await supabase
    .from("leaves")
    .select("id, start_date, end_date, profiles!leaves_profile_id_fkey(full_name)")
    .lte("start_date", dateKey(gridEnd))
    .gte("end_date", dateKey(gridStart));
  const leavesByDay = new Map<string, CalendarLeave[]>();
  for (const leave of (leaveRows ?? []) as unknown as CalendarLeave[]) {
    for (const day of gridDays) {
      const key = dateKey(day);
      const dow = day.getDay();
      if (key < leave.start_date || key > leave.end_date || dow === 0 || dow === 6) continue;
      leavesByDay.set(key, [...(leavesByDay.get(key) ?? []), leave]);
    }
  }

  const byDay = new Map<string, CalendarActivity[]>();
  for (const activity of (activities ?? []) as unknown as CalendarActivity[]) {
    const key = dateKey(new Date(activity.due_at));
    const list = byDay.get(key) ?? [];
    list.push(activity);
    byDay.set(key, list);
  }

  const prevMonthDate = new Date(year, month - 2, 1);
  const nextMonthDate = new Date(year, month, 1);
  const todayKey = dateKey(now);
  const monthLabel = monthStart.toLocaleDateString("hu-HU", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Naptár"
        description="A felvitt hívások, megtekintések, emlékeztetők és a csapat szabadságai havi nézetben."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/calendar?year=${prevMonthDate.getFullYear()}&month=${prevMonthDate.getMonth() + 1}`}
            >
              <Button variant="secondary" size="sm">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/dashboard/calendar">
              <Button variant="secondary" size="sm">
                Ma
              </Button>
            </Link>
            <Link
              href={`/dashboard/calendar?year=${nextMonthDate.getFullYear()}&month=${nextMonthDate.getMonth() + 1}`}
            >
              <Button variant="secondary" size="sm">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      <TasksViewSwitch active="calendar" />

      <div className="text-sm font-medium capitalize text-foreground">{monthLabel}</div>

      <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-background px-2 py-1.5 text-center text-xs font-medium text-muted-subtle"
          >
            {label}
          </div>
        ))}

        {gridDays.map((day) => {
          const key = dateKey(day);
          const dayActivities = byDay.get(key) ?? [];
          const inMonth = day.getMonth() === month - 1;
          const isToday = key === todayKey;
          const visible = dayActivities.slice(0, 3);
          const overflow = dayActivities.length - visible.length;

          return (
            <div
              key={key}
              className={`flex min-h-[100px] flex-col gap-1 bg-surface p-1.5 ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`self-start rounded-full px-1.5 text-xs ${
                  isToday ? "bg-accent font-medium text-white" : "text-muted-subtle"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {(leavesByDay.get(key) ?? []).map((leave) => (
                  <Link key={leave.id} href="/dashboard/leave">
                    <span
                      className="block truncate rounded bg-success-soft px-1 py-0.5 text-[11px] leading-tight text-success"
                      title={`Szabadság: ${leave.profiles?.full_name || "munkatárs"}`}
                    >
                      🌴 {leave.profiles?.full_name || "Szabadság"}
                    </span>
                  </Link>
                ))}
                {visible.map((activity) => {
                  const href = activity.deals
                    ? `/dashboard/pipeline/${activity.deals.id}`
                    : activity.contacts
                      ? `/dashboard/contacts/${activity.contacts.id}/edit`
                      : null;
                  const chip = (
                    <span
                      className={`block truncate rounded px-1 py-0.5 text-[11px] leading-tight ${
                        TYPE_CHIP_CLASS[activity.type] ?? TYPE_CHIP_CLASS.note
                      } ${activity.done ? "opacity-50 line-through" : ""}`}
                      title={activity.content}
                    >
                      {activity.content}
                    </span>
                  );
                  return href ? (
                    <Link key={activity.id} href={href}>
                      {chip}
                    </Link>
                  ) : (
                    <span key={activity.id}>{chip}</span>
                  );
                })}
                {overflow > 0 && (
                  <span className="px-1 text-[11px] text-muted-subtle">+{overflow} további</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

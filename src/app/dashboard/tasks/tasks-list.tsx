"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StickyNote, Phone, Eye, Bell, Trash2, Repeat, type LucideIcon } from "lucide-react";
import { toggleActivityDone, deleteActivity } from "../activities/actions";
import { formatDue } from "@/lib/time";
import { Card } from "@/components/ui/card";

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  note: StickyNote,
  call: Phone,
  viewing: Eye,
  reminder: Bell,
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Naponta ismétlődik",
  weekly: "Hetente ismétlődik",
  monthly: "Havonta ismétlődik",
};

export type TaskRow = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  done: boolean;
  recurrence: string;
  contacts: { id: string; name: string } | null;
  deals: { id: string } | null;
};

function activityHref(task: TaskRow): string | null {
  if (task.deals) return `/dashboard/pipeline/${task.deals.id}`;
  if (task.contacts) return `/dashboard/contacts/${task.contacts.id}/edit`;
  return null;
}

function groupLabel(task: TaskRow): string {
  if (task.done) return "Kész";
  if (!task.due_at) return "Nincs határidő";

  const due = new Date(task.due_at);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  if (due < todayStart) return "Lejárt";
  if (due < todayEnd) return "Ma esedékes";
  return "Következő";
}

const GROUP_ORDER = ["Lejárt", "Ma esedékes", "Következő", "Nincs határidő", "Kész"];

export function TasksList({ activities }: { activities: TaskRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, done: boolean) {
    startTransition(() => {
      toggleActivityDone(id, done, "/dashboard/tasks");
    });
  }

  const groups = new Map<string, TaskRow[]>();
  for (const task of activities) {
    const group = groupLabel(task);
    const list = groups.get(group) ?? [];
    list.push(task);
    groups.set(group, list);
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUP_ORDER.filter((group) => groups.has(group)).map((group) => (
        <div key={group}>
          <div
            className={`mb-2 text-xs font-semibold tracking-wide uppercase ${
              group === "Lejárt" ? "text-danger" : "text-muted"
            }`}
          >
            {group} ({groups.get(group)!.length})
          </div>
          <div className="flex flex-col gap-2">
            {groups.get(group)!.map((task) => {
              const Icon = TYPE_ICONS[task.type] ?? StickyNote;
              const href = activityHref(task);
              return (
                <Card
                  key={task.id}
                  className={`flex items-start gap-2.5 p-3 text-sm ${
                    task.done ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    disabled={isPending}
                    onChange={(e) => handleToggle(task.id, e.target.checked)}
                    className="mt-1 h-3.5 w-3.5 accent-accent"
                  />
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <span>
                        {TYPE_LABELS[task.type] ?? task.type}
                        {task.due_at &&
                          ` · ${formatDue(task.due_at)}`}
                      </span>
                      {task.recurrence !== "none" && (
                        <span title={RECURRENCE_LABELS[task.recurrence]}>
                          <Repeat className="h-3 w-3 text-accent" />
                        </span>
                      )}
                    </div>
                    <div className="break-words text-foreground">{task.content}</div>
                    {task.contacts && (
                      <div className="mt-0.5">
                        {href ? (
                          <Link
                            href={href}
                            className="text-xs text-accent hover:underline"
                          >
                            {task.contacts.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">{task.contacts.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <form action={deleteActivity}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="redirect_to" value="/dashboard/tasks" />
                    <button type="submit" className="text-muted-subtle hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

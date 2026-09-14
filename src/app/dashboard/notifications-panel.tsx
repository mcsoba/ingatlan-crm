"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CircleAlert, Clock, UserPlus } from "lucide-react";
import { getNotifications, type NotificationsData } from "./notifications-actions";

function activityHref(contactId: string | null, dealId: string | null): string {
  if (dealId) return `/dashboard/pipeline/${dealId}`;
  if (contactId) return `/dashboard/contacts/${contactId}/edit`;
  return "/dashboard/calendar";
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsData | null>(null);

  useEffect(() => {
    getNotifications()
      .then(setData)
      .catch(() => {
        // Non-critical widget — silently skip on failure.
      });
  }, []);

  const count = data ? data.overdue.length + data.dueToday.length + data.newLeads.length : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        Értesítések
        {count > 0 && (
          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-1 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-lg">
            {!data ? (
              <p className="p-2 text-sm text-muted">Betöltés…</p>
            ) : count === 0 ? (
              <p className="p-2 text-sm text-muted">Nincs friss értesítés.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.overdue.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-danger">
                      <CircleAlert className="h-3 w-3" />
                      Lejárt teendők
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {data.overdue.map((a) => (
                        <Link
                          key={a.id}
                          href={activityHref(a.contactId, a.dealId)}
                          onClick={() => setOpen(false)}
                          className="truncate rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-background"
                        >
                          {a.content}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {data.dueToday.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-warning">
                      <Clock className="h-3 w-3" />
                      Ma esedékes
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {data.dueToday.map((a) => (
                        <Link
                          key={a.id}
                          href={activityHref(a.contactId, a.dealId)}
                          onClick={() => setOpen(false)}
                          className="truncate rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-background"
                        >
                          {a.content}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {data.newLeads.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-accent">
                      <UserPlus className="h-3 w-3" />
                      Új érdeklődők
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {data.newLeads.map((l) => (
                        <Link
                          key={l.id}
                          href={`/dashboard/contacts/${l.id}/edit`}
                          onClick={() => setOpen(false)}
                          className="truncate rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-background"
                        >
                          {l.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

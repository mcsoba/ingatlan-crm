"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Trash2,
  StickyNote,
  Phone,
  Eye,
  Bell,
  ClipboardCheck,
  Mail,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import {
  createActivity,
  deleteActivity,
  summarizeActivityNote,
  toggleActivityDone,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
  checklist: "Checklist",
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  note: StickyNote,
  call: Phone,
  viewing: Eye,
  reminder: Bell,
  checklist: ClipboardCheck,
};

export type Activity = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  done: boolean;
  email_body?: string | null;
  sequence_id?: string | null;
};

export function ActivityPanel({
  contactId,
  dealId,
  activities,
  redirectTo,
}: {
  contactId?: string;
  dealId?: string;
  activities: Activity[];
  redirectTo: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [type, setType] = useState("note");
  const [content, setContent] = useState("");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummarizing, startSummarizing] = useTransition();

  function handleToggle(id: string, done: boolean) {
    startTransition(() => {
      toggleActivityDone(id, done, redirectTo);
    });
  }

  function handleSummarize() {
    setSummaryError(null);
    startSummarizing(async () => {
      try {
        const summary = await summarizeActivityNote({ type, rawText: content });
        setContent(summary);
      } catch (err) {
        setSummaryError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.length === 0 ? (
        <EmptyState icon={StickyNote} title="Még nincs aktivitás" />
      ) : (
        <div className="flex flex-col gap-2">
          {activities.map((activity) => {
            const Icon = TYPE_ICONS[activity.type] ?? StickyNote;
            const isExpanded = expandedIds.has(activity.id);
            return (
              <Card
                key={activity.id}
                className={`flex items-start gap-2.5 p-3 text-sm ${
                  activity.done ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={activity.done}
                  disabled={isPending}
                  onChange={(e) => handleToggle(activity.id, e.target.checked)}
                  className="mt-1 h-3.5 w-3.5 accent-accent"
                />
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">
                    {TYPE_LABELS[activity.type] ?? activity.type}
                    {activity.due_at &&
                      ` · határidő: ${new Date(activity.due_at).toLocaleDateString("hu-HU")}`}
                  </div>
                  <div className="break-words text-foreground">
                    {activity.content}
                  </div>
                  {(activity.email_body || activity.sequence_id) && (
                    <div className="mt-1.5 flex items-center gap-3">
                      {activity.email_body && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(activity.id)}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {isExpanded ? "Elrejtés" : "Email megtekintése"}
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      {activity.sequence_id && (
                        <Link
                          href={`/dashboard/campaigns/${activity.sequence_id}`}
                          className="text-xs text-muted hover:text-accent"
                        >
                          Kampány megtekintése →
                        </Link>
                      )}
                    </div>
                  )}
                  {isExpanded && activity.email_body && (
                    <div className="mt-2 whitespace-pre-line rounded-lg border border-border bg-background p-2.5 text-xs text-muted">
                      {activity.email_body}
                    </div>
                  )}
                </div>
                <form action={deleteActivity}>
                  <input type="hidden" name="id" value={activity.id} />
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <button
                    type="submit"
                    className="text-muted-subtle hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="flex flex-col gap-2 p-3">
        <form action={createActivity} className="flex flex-col gap-2">
          {contactId && (
            <input type="hidden" name="contact_id" value={contactId} />
          )}
          {dealId && <input type="hidden" name="deal_id" value={dealId} />}
          <input type="hidden" name="redirect_to" value={redirectTo} />

          <div className="flex gap-2">
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`${inputClass} py-1.5`}
            >
              <option value="note">Jegyzet</option>
              <option value="call">Hívás</option>
              <option value="viewing">Megtekintés</option>
              <option value="reminder">Emlékeztető</option>
              <option value="checklist">Checklist</option>
            </select>
            <input
              type="date"
              name="due_at"
              className={`${inputClass} py-1.5`}
            />
            <select
              name="recurrence"
              defaultValue="none"
              title="Ismétlődés"
              className={`${inputClass} py-1.5`}
            >
              <option value="none">Nem ismétlődik</option>
              <option value="daily">Naponta</option>
              <option value="weekly">Hetente</option>
              <option value="monthly">Havonta</option>
            </select>
          </div>
          <textarea
            name="content"
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Mi történt / mit kell tenni? (nyers jegyzet is jó, az AI átszerkesztheti)"
            className={inputClass}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">
              Hozzáadás
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSummarize}
              disabled={isSummarizing || !content.trim()}
            >
              {isSummarizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              )}
              AI összefoglalás
            </Button>
          </div>
          {summaryError && (
            <span className="text-xs text-danger">{summaryError}</span>
          )}
        </form>
      </Card>
    </div>
  );
}

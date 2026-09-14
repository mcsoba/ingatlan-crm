"use client";

import { useState, useTransition } from "react";
import {
  createActivity,
  deleteActivity,
  summarizeActivityNote,
  toggleActivityDone,
} from "./actions";

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

export type Activity = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  done: boolean;
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
      <div className="flex flex-col gap-2">
        {activities.length === 0 && (
          <p className="text-sm text-neutral-500">Még nincs aktivitás.</p>
        )}
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`flex items-start gap-2 rounded border border-neutral-200 p-2 text-sm ${
              activity.done ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={activity.done}
              disabled={isPending}
              onChange={(e) => handleToggle(activity.id, e.target.checked)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-xs text-neutral-500">
                {TYPE_LABELS[activity.type] ?? activity.type}
                {activity.due_at &&
                  ` · határidő: ${new Date(activity.due_at).toLocaleDateString("hu-HU")}`}
              </div>
              <div>{activity.content}</div>
            </div>
            <form action={deleteActivity}>
              <input type="hidden" name="id" value={activity.id} />
              <input type="hidden" name="redirect_to" value={redirectTo} />
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Törlés
              </button>
            </form>
          </div>
        ))}
      </div>

      <form
        action={createActivity}
        className="flex flex-col gap-2 rounded border border-neutral-200 p-3"
      >
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
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="note">Jegyzet</option>
            <option value="call">Hívás</option>
            <option value="viewing">Megtekintés</option>
            <option value="reminder">Emlékeztető</option>
          </select>
          <input
            type="date"
            name="due_at"
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <textarea
          name="content"
          required
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Mi történt / mit kell tenni? (nyers jegyzet is jó, az AI átszerkesztheti)"
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            Hozzáadás
          </button>
          <button
            type="button"
            onClick={handleSummarize}
            disabled={isSummarizing || !content.trim()}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSummarizing ? "Összefoglalás…" : "AI összefoglalás"}
          </button>
        </div>
        {summaryError && (
          <span className="text-xs text-red-600">{summaryError}</span>
        )}
      </form>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/** Kis kuka ikon egy lista sorában; kattintásra „Törlöd? Igen / Nem” — végleges törlés. */
export function RowDelete({ id, action, title = "Tétel törlése" }: { id: string; action: (id: string) => Promise<void>; title?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={() => setConfirming(true)}
        className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <span className="flex items-center justify-end gap-1.5 whitespace-nowrap text-xs">
      <span className="text-muted">{error ?? "Törlöd?"}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await action(id);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Nem sikerült");
            }
          })
        }
        className="rounded bg-danger px-1.5 py-0.5 font-medium text-white disabled:opacity-50"
      >
        {isPending ? "…" : "Igen"}
      </button>
      <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className="text-muted hover:text-foreground">
        Nem
      </button>
    </span>
  );
}

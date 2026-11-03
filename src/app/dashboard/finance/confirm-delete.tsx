"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

// Végleges törlés kétlépcsős megerősítéssel (a pénzügyi tételek nem kerülnek Lomtárba).
export function ConfirmDelete({
  action,
  fields,
  label,
  question,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  question: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{question}</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields)) fd.set(k, v);
          startTransition(() => action(fd));
        }}
        className="rounded-md bg-danger px-2 py-1 font-medium text-white hover:bg-danger/90 disabled:opacity-50"
      >
        Igen, törlöm
      </button>
      <button type="button" disabled={isPending} onClick={() => setConfirming(false)} className="text-muted hover:text-foreground">
        Mégse
      </button>
    </span>
  );
}

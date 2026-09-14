"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { getAttachmentDownloadUrl } from "./actions";

export function DownloadButton({ path }: { path: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const url = await getAttachmentDownloadUrl(path);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-muted-subtle hover:text-accent"
        title="Letöltés"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

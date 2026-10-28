"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteDeal } from "../actions";
import { queueToast } from "@/components/ui/toast";

// Üzlet törlése megerősítéssel (Lomtárba kerül, 30 napig visszaállítható).
// compact: kis változat listákba és a táblán lévő kártyákra.
export function DeleteDealButton({
  dealId,
  dealTitle,
  compact = false,
}: {
  dealId: string;
  dealTitle: string;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    const fd = new FormData();
    fd.set("id", dealId);
    // Queued before the call: deleteDeal redirects server-side, so this
    // component unmounts before any code after the call would run.
    queueToast({
      title: `"${dealTitle}" üzlet törölve`,
      variant: "success",
      undo: { table: "deals", id: dealId },
    });
    startTransition(() => {
      deleteDeal(fd);
    });
  }

  const size = compact ? "text-xs" : "text-sm";

  if (confirming) {
    return (
      <span
        className={`flex flex-wrap items-center gap-2 ${size}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-muted">
          {compact ? "Törlöd?" : "Biztosan törlöd? A Lomtárból 30 napig visszaállítható."}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={remove}
          className="rounded-md bg-danger px-2 py-1 font-medium text-white hover:bg-danger/90 disabled:opacity-50"
        >
          Igen, törlöm
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="text-muted hover:text-foreground"
        >
          Mégse
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      onPointerDown={(e) => e.stopPropagation()}
      title="Üzlet törlése"
      className={`flex items-center gap-1.5 ${size} text-muted hover:text-danger`}
    >
      <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {compact ? "Törlés" : "Üzlet törlése"}
    </button>
  );
}

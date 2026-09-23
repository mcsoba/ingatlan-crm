"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteDeal } from "../actions";
import { queueToast } from "@/components/ui/toast";

export function DeleteDealButton({
  dealId,
  dealTitle,
}: {
  dealId: string;
  dealTitle: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", dealId);
        // Queued before the call: deleteDeal redirects server-side, so this
        // component unmounts before any code after the call would run.
        queueToast({
          title: `"${dealTitle}" deal törölve`,
          variant: "success",
          undo: { table: "deals", id: dealId },
        });
        startTransition(() => {
          deleteDeal(fd);
        });
      }}
      className="flex items-center gap-1.5 text-sm text-muted hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Deal törlése
    </button>
  );
}

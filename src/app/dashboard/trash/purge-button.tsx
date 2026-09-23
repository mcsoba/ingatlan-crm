"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { purgeRecord } from "./actions";
import { Button } from "@/components/ui/button";

export function PurgeButton({ table, id }: { table: string; id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    startTransition(async () => {
      await purgeRecord(table, id);
    });
  }

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      onClick={handleClick}
      onBlur={() => setConfirm(false)}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {confirm ? "Biztos? Kattints újra" : "Végleges törlés"}
    </Button>
  );
}

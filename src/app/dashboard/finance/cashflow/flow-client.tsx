"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBankBalance, saveBankBalance } from "../flow-actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export function BalanceForm({ companyId, defaultDate }: { companyId: string; defaultDate: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            await saveBankBalance(fd);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nem sikerült");
          }
        })
      }
    >
      <input type="hidden" name="company_id" value={companyId} />
      <label className="flex flex-col gap-1 text-xs text-muted">
        Dátum (a nap végén)
        <input type="date" name="balance_date" defaultValue={defaultDate} className={`${inputClass} w-auto py-1.5`} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Egyenleg a bank szerint (Ft)
        <input name="balance" inputMode="decimal" required placeholder="pl. 3 534 465" className={`${inputClass} w-44 py-1.5`} />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted">
        Megjegyzés
        <input name="note" placeholder="pl. decemberi kivonat záró egyenlege" className={`${inputClass} py-1.5`} />
      </label>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Mentés…" : "Egyenleg rögzítése"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </form>
  );
}

export function BalanceDelete({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button type="button" title="Egyenleg törlése" disabled={isPending} onClick={() => startTransition(() => deleteBankBalance(id))} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

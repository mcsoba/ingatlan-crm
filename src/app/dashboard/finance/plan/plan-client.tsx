"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addPlanItem, deletePlanItem } from "../plan-actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export function PlanItemForm({ companyId, month }: { companyId: string; month: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7"
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            await addPlanItem(fd);
            setKey((k) => k + 1);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nem sikerült");
          }
        })
      }
    >
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="month" value={month} />
      <label className="flex flex-col gap-1 text-xs text-muted">
        Fajta
        <select name="kind" defaultValue="expense" className={inputClass}>
          <option value="expense">Várható kiadás</option>
          <option value="income">Várható bevétel</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
        Mi?
        <input name="description" required placeholder="pl. iroda kauciója, új szállás kauciója" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Kitől / kinek
        <input name="counterparty" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Összeg (Ft)
        <input name="amount" required inputMode="decimal" placeholder="0" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Várható nap
        <input type="date" name="expected_date" min={`${month}-01`} max={`${month}-31`} className={inputClass} />
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Mentés…" : "Hozzáadás"}
        </Button>
      </div>
      {error && <span className="text-xs text-danger sm:col-span-2 lg:col-span-7">{error}</span>}
    </form>
  );
}

export function PlanItemDelete({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button type="button" title="Tétel törlése" disabled={isPending} onClick={() => startTransition(() => deletePlanItem(id))} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

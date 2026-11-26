"use client";

import { useState, useTransition } from "react";
import { createLoanMove } from "../loan-actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export function LoanForm({ companyId, people, today }: { companyId: string; people: { id: string; name: string }[]; today: string }) {
  const [kind, setKind] = useState<"lend" | "repay">("lend");
  const [person, setPerson] = useState(people[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          setSaved(null);
          try {
            await createLoanMove(fd);
            setSaved(kind === "lend" ? "Kölcsön rögzítve" : "Visszafizetés rögzítve");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nem sikerült");
          }
        })
      }
    >
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex w-fit gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
        {(
          [
            ["lend", "A cég kölcsönt ad"],
            ["repay", "A tag visszafizet"],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setKind(v)} className={`rounded-md px-3 py-1 ${kind === v ? "bg-accent-soft font-medium text-accent-hover" : "text-muted hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Tag
          <select name="person_id" value={person} onChange={(e) => setPerson(e.target.value)} className={inputClass}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="">+ új tag…</option>
          </select>
        </label>
        {person === "" && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Új tag neve
            <input name="new_name" required className={inputClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Összeg (Ft)
          <input name="amount" inputMode="decimal" required placeholder="0" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Dátum
          <input type="date" name="date" defaultValue={today} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Mód
          <select name="payment_method" defaultValue="transfer" className={inputClass}>
            <option value="transfer">Átutalás</option>
            <option value="cash">Készpénz</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Megjegyzés
          <input name="note" className={inputClass} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Mentés…" : kind === "lend" ? "Kölcsön rögzítése" : "Visszafizetés rögzítése"}
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
        {saved && <span className="text-xs text-success">{saved}</span>}
      </div>
    </form>
  );
}

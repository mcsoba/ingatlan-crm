"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { deleteTaxObligation, loadDefaultTaxObligations, saveTaxObligation, setTaxDone } from "../tax-actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import type { TaxObligation } from "@/lib/finance-tax";

function useRun() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nem sikerült");
      }
    });
  return { isPending, error, run };
}

export function LoadDefaultsButton({ companyId }: { companyId: string }) {
  const { isPending, error, run } = useRun();
  return (
    <div className="flex flex-col gap-1">
      <Button disabled={isPending} onClick={() => run(() => loadDefaultTaxObligations(companyId))}>
        {isPending ? "Betöltés…" : "Alap adónaptár betöltése"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/** „Kész” jelölés egy esedékességnél — opcionális összeggel / megjegyzéssel. */
export function DoneButton({ obligationId, nominal, done, defaultAmount }: { obligationId: string; nominal: string; done: boolean; defaultAmount: number | null }) {
  const { isPending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [note, setNote] = useState("");
  if (done)
    return (
      <button type="button" disabled={isPending} onClick={() => run(() => setTaxDone(obligationId, nominal, false))} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
        <Undo2 className="h-3.5 w-3.5" />
        Visszavonás
      </button>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        Kész
      </button>
    );
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="összeg (nem kötelező)" inputMode="decimal" className={`${inputClass} w-36 py-1 text-xs`} />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="megjegyzés" className={`${inputClass} w-36 py-1 text-xs`} />
      <Button size="sm" disabled={isPending} onClick={() => run(() => setTaxDone(obligationId, nominal, true, amount, note), () => setOpen(false))}>
        Bevallva / befizetve
      </Button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">
        Mégse
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

/** Kötelezettség szerkesztése / felvétele. */
export function ObligationForm({ companyId, obligation }: { companyId: string; obligation?: TaxObligation }) {
  const { isPending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMonthly = obligation ? obligation.schedule.startsWith("monthly") : false;
  const [mode, setMode] = useState<"monthly" | "fixed">(isMonthly ? "monthly" : "fixed");
  const rest = obligation?.schedule.split(":")[1] ?? "";

  if (!open)
    return obligation ? (
      <span className="flex items-center gap-1">
        <button type="button" title="Szerkesztés" onClick={() => setOpen(true)} className="rounded p-1 text-muted hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-muted">Törlöd a teljesítésekkel együtt?</span>
            <button type="button" disabled={isPending} onClick={() => run(() => deleteTaxObligation(obligation.id))} className="rounded bg-danger px-1.5 py-0.5 font-medium text-white">
              Igen
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted">
              Nem
            </button>
          </span>
        ) : (
          <button type="button" title="Törlés" onClick={() => setConfirmDelete(true)} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + Új kötelezettség
      </Button>
    );

  return (
    <form
      action={(fd) => run(() => saveTaxObligation(fd), () => setOpen(false))}
      className="mt-2 grid w-full gap-2 rounded-lg border border-border bg-background/50 p-3 sm:grid-cols-2 lg:grid-cols-6"
    >
      <input type="hidden" name="id" value={obligation?.id ?? ""} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="mode" value={mode} />
      <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
        Megnevezés
        <input name="name" required defaultValue={obligation?.name} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Gyakoriság
        <select value={mode} onChange={(e) => setMode(e.target.value as "monthly" | "fixed")} className={inputClass}>
          <option value="monthly">Havonta</option>
          <option value="fixed">Évente fix napokon</option>
        </select>
      </label>
      {mode === "monthly" ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          A következő hónap hányadikáig?
          <input name="day" type="number" min={1} max={28} defaultValue={isMonthly ? rest : "12"} className={inputClass} />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Határidők (hó-nap, vesszővel)
          <input name="dates" defaultValue={!isMonthly ? rest.replaceAll(",", ", ") : ""} placeholder="pl. 03-15, 09-15" className={inputClass} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Település (ha helyi adó)
        <input name="municipality" defaultValue={obligation?.municipality ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Szokásos összeg (Ft)
        <input name="amount" inputMode="decimal" defaultValue={obligation?.amount ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2 lg:col-span-4">
        Megjegyzés
        <input name="notes" defaultValue={obligation?.notes ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Állapot
        <select name="active" defaultValue={obligation?.active === false ? "no" : "yes"} className={inputClass}>
          <option value="yes">Aktív</option>
          <option value="no">Kikapcsolva (nem vonatkozik ránk)</option>
        </select>
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Mentés…" : "Mentés"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">
          Mégse
        </button>
      </div>
      {error && <span className="text-xs text-danger sm:col-span-2 lg:col-span-6">{error}</span>}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, Link2, Plus, Trash2 } from "lucide-react";
import { addPayment, createStorno, deletePayment, linkCorrection } from "./storno-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";
import { PAYMENT_METHOD_LABELS, formatDate, formatMoney, type Currency } from "@/lib/finance";

export type PaymentRow = { id: string; paid_date: string; amount: number; payment_method: "transfer" | "card" | "cash"; note: string | null };
export type LinkedInvoice = { id: string; invoice_number: string | null; issue_date: string; gross_amount: number; description: string };

function useAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        // a redirect() „hibája” nem hiba
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setError(e instanceof Error ? e.message : "Nem sikerült");
      }
    });
  return { isPending, error, run };
}

/** Részletfizetés: több befizetés egy tételhez; a hátralék és az állapot ebből jön. */
export function PaymentsPanel({
  invoiceId,
  payable,
  currency,
  payments,
  defaultMethod,
  today,
  settledWithoutParts,
}: {
  invoiceId: string;
  payable: number;
  currency: Currency;
  payments: PaymentRow[];
  defaultMethod: "transfer" | "card" | "cash";
  today: string;
  /** egy összegben kipipálva (részletek nélkül) */
  settledWithoutParts: boolean;
}) {
  const { isPending, error, run } = useAction();
  const [open, setOpen] = useState(payments.length > 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, payable - paid);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex w-fit items-center gap-1.5 text-sm text-accent hover:underline">
        <Plus className="h-3.5 w-3.5" />
        {settledWithoutParts ? "Részletekben fizették? Befizetések rögzítése" : "Részletfizetés rögzítése"}
      </button>
    );

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold">Befizetések</h2>
        <span className="text-sm tabular-nums text-muted">
          {formatMoney(paid, currency)} / {formatMoney(payable, currency)}
          {remaining > 0.5 ? <span className="font-medium text-warning"> · hátralék: {formatMoney(remaining, currency)}</span> : <span className="font-medium text-success"> · teljesen kifizetve</span>}
        </span>
      </div>
      {payments.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-1.5">
              <span className="tabular-nums text-muted">{formatDate(p.paid_date)}</span>
              <span className="font-medium tabular-nums">{formatMoney(Number(p.amount), currency)}</span>
              <span className="text-xs text-muted">{PAYMENT_METHOD_LABELS[p.payment_method]}</span>
              <span className="flex-1 truncate text-xs text-muted">{p.note}</span>
              <button type="button" title="Befizetés törlése" disabled={isPending} onClick={() => run(() => deletePayment(p.id))} className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {settledWithoutParts && payments.length === 0 && (
        <p className="text-xs text-muted">A tétel most egy összegben ki van pipálva. Ha részleteket rögzítesz, az állapotot a részletek összege adja.</p>
      )}
      <form action={(fd) => run(() => addPayment(fd))} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          Dátum
          <input type="date" name="paid_date" defaultValue={today} className={`${inputClass} w-auto py-1.5`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Összeg
          <input name="amount" inputMode="decimal" defaultValue={remaining > 0.5 ? String(Math.round(remaining)) : ""} className={`${inputClass} w-32 py-1.5`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Mód
          <select name="payment_method" defaultValue={defaultMethod} className={`${inputClass} w-auto py-1.5`}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted">
          Megjegyzés
          <input name="note" placeholder="pl. 1. részlet" className={`${inputClass} py-1.5`} />
        </label>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Mentés…" : "Befizetés hozzáadása"}
        </Button>
      </form>
      {error && <span className="text-xs text-danger">{error}</span>}
    </Card>
  );
}

/** Sztornó: kapcsolat megjelenítése, új sztornó rögzítése, vagy meglévő negatív tétel hozzákötése. */
export function CorrectionPanel({
  invoiceId,
  gross,
  currency,
  isPlanned,
  correctedBy,
  corrects,
  candidates,
  today,
  back,
}: {
  invoiceId: string;
  gross: number;
  currency: Currency;
  isPlanned: boolean;
  correctedBy: LinkedInvoice[];
  corrects: LinkedInvoice | null;
  candidates: LinkedInvoice[];
  today: string;
  back: string;
}) {
  const { isPending, error, run } = useAction();
  const [mode, setMode] = useState<"none" | "storno" | "link">("none");
  const [pick, setPick] = useState(candidates[0]?.id ?? "");
  const href = (id: string) => `/dashboard/finance/invoices/${id}?back=${encodeURIComponent(back)}`;
  const label = (i: LinkedInvoice) => `${i.invoice_number ?? "szám nélkül"} · ${formatDate(i.issue_date)} · ${formatMoney(Number(i.gross_amount), currency)}`;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {correctedBy.map((c) => (
        <p key={c.id} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-background px-3 py-1.5">
          <Ban className="h-4 w-4 text-muted" />
          {Number(c.gross_amount) < 0 ? "Sztornózva:" : "Helyesbítve:"}{" "}
          <Link href={href(c.id)} className="font-medium text-accent hover:underline">
            {label(c)}
          </Link>
        </p>
      ))}
      {corrects && (
        <p className="inline-flex w-fit flex-wrap items-center gap-1.5 rounded-lg bg-background px-3 py-1.5">
          <Link2 className="h-4 w-4 text-muted" />
          {gross < 0 ? "Ez a tétel ennek a sztornója:" : "Ez a tétel ezt helyesbíti:"}{" "}
          <Link href={href(corrects.id)} className="font-medium text-accent hover:underline">
            {label(corrects)}
          </Link>
          <button type="button" disabled={isPending} onClick={() => run(() => linkCorrection(invoiceId, null))} className="text-xs text-muted hover:text-danger">
            (kapcsolat bontása)
          </button>
        </p>
      )}

      {!corrects && !isPlanned && gross > 0 && !correctedBy.some((c) => Number(c.gross_amount) < 0) && mode === "none" && (
        <button type="button" onClick={() => setMode("storno")} className="inline-flex w-fit items-center gap-1.5 text-muted hover:text-foreground">
          <Ban className="h-3.5 w-3.5" />
          Sztornózás rögzítése
        </button>
      )}
      {!corrects && gross <= 0 && candidates.length > 0 && mode === "none" && (
        <button type="button" onClick={() => setMode("link")} className="inline-flex w-fit items-center gap-1.5 text-accent hover:underline">
          <Link2 className="h-3.5 w-3.5" />
          Melyik számla sztornója / helyesbítője? Összekötés
        </button>
      )}

      {mode === "storno" && (
        <Card className="flex flex-col gap-2 p-3">
          <p className="text-xs text-muted">
            Létrejön a tétel negatív párja (sztornó számla), és összekötöm őket. Ha az eredetit még nem fizették ki, mindkettő rendezett lesz; ha már igen, a sztornó nyitott marad (vissza kell fizetni).
          </p>
          <form action={(fd) => run(() => createStorno(fd))} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoice_id" value={invoiceId} />
            <input type="hidden" name="return_to" value={back} />
            <label className="flex flex-col gap-1 text-xs text-muted">
              Sztornó számla száma
              <input name="invoice_number" placeholder="pl. WRKR-2026-230" className={`${inputClass} w-48 py-1.5`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Kelte
              <input type="date" name="issue_date" defaultValue={today} className={`${inputClass} w-auto py-1.5`} />
            </label>
            <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
              {isPending ? "Mentés…" : "Sztornó rögzítése"}
            </Button>
            <button type="button" onClick={() => setMode("none")} className="text-xs text-muted">
              Mégse
            </button>
          </form>
        </Card>
      )}
      {mode === "link" && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${inputClass} w-auto py-1.5`}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c)} — {c.description}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={isPending || !pick} onClick={() => run(() => linkCorrection(invoiceId, pick))}>
            Összekötés
          </Button>
          <button type="button" onClick={() => setMode("none")} className="text-xs text-muted">
            Mégse
          </button>
        </div>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

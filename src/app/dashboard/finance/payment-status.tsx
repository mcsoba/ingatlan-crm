import { Check, Landmark, Undo2, X } from "lucide-react";
import { markInvoice } from "./actions";
import { inputClass } from "@/components/ui/styles";
import { formatDate, formatMoney, payableAmount, settledAmount, type InvoiceRow } from "@/lib/finance";

export function UndoButton({ id, action, label }: { id: string; action: "undo_paid" | "undo_booked"; label: string }) {
  return (
    <form action={markInvoice}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted hover:border-danger hover:text-danger"
      >
        <Undo2 className="h-3.5 w-3.5" />
        {label}
      </button>
    </form>
  );
}

function MarkForm({ id, action, label, today }: { id: string; action: "paid" | "booked"; label: string; today: string }) {
  return (
    <form action={markInvoice} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <input type="date" name="date" defaultValue={today} aria-label="Dátum" className={`${inputClass} w-auto py-1.5`} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        {label}
      </button>
    </form>
  );
}

/**
 * Az adatlap tetején, nagyban: ki van-e fizetve és le van-e könyvelve a tétel.
 * Mindkettő egy kattintással jelölhető és visszavonható.
 */
export function PaymentStatus({ inv, today }: { inv: InvoiceRow; today: string }) {
  // Kimenő tervezett tételnél előbb ki kell állítani a számlát (Számlázz.hu panel)
  if (inv.is_planned && inv.direction === "out") return null;
  const isOut = inv.direction === "out";
  // Negatív tétel (sztornó / jóváírás): a pénz visszafelé mozog
  const refund = Number(inv.gross_amount) < 0;
  const paidWord = refund ? (isOut ? "Visszafizettük" : "Visszakaptuk") : isOut ? "Kiegyenlítve (megérkezett a pénz)" : "Kifizetve";
  const unpaidWord = refund ? (isOut ? "Vissza kell fizetnünk" : "Visszajár nekünk") : isOut ? "Még nem fizették ki nekünk" : "Még nincs kifizetve";
  const overdue = !inv.paid_date && inv.due_date && inv.due_date < today;
  const needsBooking = inv.payment_method !== "cash";

  return (
    <div className={`grid gap-3 ${needsBooking ? "md:grid-cols-2" : ""}`}>
      {inv.paid_date ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-success/50 bg-success-soft p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <Check className="h-6 w-6" strokeWidth={3} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-success">{paidWord}</div>
            <div className="text-sm text-foreground">
              {formatDate(inv.paid_date)} · {formatMoney(Math.abs(settledAmount(inv)), inv.currency)}
            </div>
          </div>
          <UndoButton id={inv.id} action="undo_paid" label="Visszavonás" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-danger/50 bg-danger-soft p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger text-white">
            <X className="h-6 w-6" strokeWidth={3} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-danger">{unpaidWord}</div>
            <div className="text-sm text-foreground">
              {formatMoney(Math.abs(payableAmount(inv)), inv.currency)}
              {inv.due_date && (
                <span className={overdue ? "font-semibold text-danger" : "text-muted"}>
                  {" "}
                  · határidő: {formatDate(inv.due_date)}
                  {overdue && " (lejárt)"}
                </span>
              )}
            </div>
          </div>
          <MarkForm id={inv.id} action="paid" label={refund ? (isOut ? "Visszafizettük" : "Visszakaptuk") : isOut ? "Megérkezett" : "Kifizettük"} today={today} />
        </div>
      )}

      {needsBooking &&
        (inv.bank_booked_date ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/40 bg-surface p-4">
            <Landmark className="h-6 w-6 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-success">✓ Bankkivonattal egyeztetve</div>
              <div className="text-sm text-muted">{formatDate(inv.bank_booked_date)}</div>
            </div>
            <UndoButton id={inv.id} action="undo_booked" label="Visszavonás" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <Landmark className="h-6 w-6 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">Bankkivonattal még nincs egyeztetve</div>
              <div className="text-xs text-muted">Jelöld, ha a tétel megjelent a bankszámlakivonaton.</div>
            </div>
            <MarkForm id={inv.id} action="booked" label="Könyvelve" today={today} />
          </div>
        ))}
    </div>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetch-all";

/**
 * Sztornó-kapcsolatok és részletfizetések — külön lekérdezve, hogy a 0050-es migráció
 * előtt (amikor a mezők / tábla még nem léteznek) se törjön el egyetlen oldal sem:
 * ilyenkor egyszerűen üres.
 */
export type InvoiceExtras = {
  /** sztornózott eredeti + maga a sztornó számla */
  cancelled: Set<string>;
  /** eredeti → az őt javító (sztornó / helyesbítő) tételek */
  correctedBy: Map<string, string[]>;
  /** javító tétel → az eredeti */
  corrects: Map<string, string>;
  /** részben fizetett tételek: eddig befizetett összeg */
  paidSoFar: Map<string, number>;
  available: boolean;
};

export const NO_EXTRAS: InvoiceExtras = { cancelled: new Set(), correctedBy: new Map(), corrects: new Map(), paidSoFar: new Map(), available: false };

export async function loadInvoiceExtras(supabase: SupabaseClient): Promise<InvoiceExtras> {
  const [links, payments] = await Promise.all([
    fetchAll<{ id: string; corrects_invoice_id: string; gross_amount: number }>(() =>
      supabase.from("finance_invoices").select("id, corrects_invoice_id, gross_amount").not("corrects_invoice_id", "is", null),
    ),
    fetchAll<{ invoice_id: string; amount: number }>(() => supabase.from("finance_payments").select("id, invoice_id, amount")),
  ]);
  if (links.error) return NO_EXTRAS;
  const extras: InvoiceExtras = { cancelled: new Set(), correctedBy: new Map(), corrects: new Map(), paidSoFar: new Map(), available: true };
  for (const l of links.data) {
    extras.corrects.set(l.id, l.corrects_invoice_id);
    extras.correctedBy.set(l.corrects_invoice_id, [...(extras.correctedBy.get(l.corrects_invoice_id) ?? []), l.id]);
    // Negatív (sztornó) számla: az eredeti és a sztornó is érvénytelen; 0 Ft-os helyesbítő: csak önmaga
    if (Number(l.gross_amount) < 0) extras.cancelled.add(l.corrects_invoice_id);
    if (Number(l.gross_amount) <= 0) extras.cancelled.add(l.id);
  }
  if (!payments.error) for (const p of payments.data) extras.paidSoFar.set(p.invoice_id, (extras.paidSoFar.get(p.invoice_id) ?? 0) + Number(p.amount));
  return extras;
}

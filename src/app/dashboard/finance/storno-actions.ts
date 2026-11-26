"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { parseAmount, payableAmount, roundMoney, todayIso, type Currency } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidate() {
  revalidatePath("/dashboard/finance", "layout");
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ---------- részletfizetés ----------

/** A befizetések összegéből a tétel fizetési állapota: teljes összegnél rendezett, alatta nyitott (részben fizetve). */
async function recomputePaid(supabase: Supabase, invoiceId: string) {
  const [{ data: inv, error }, { data: pays }] = await Promise.all([
    supabase.from("finance_invoices").select("direction, gross_amount, szja_withheld, currency").eq("id", invoiceId).single(),
    supabase.from("finance_payments").select("paid_date, amount").eq("invoice_id", invoiceId),
  ]);
  if (error) throw error;
  const list = pays ?? [];
  if (!list.length) return; // nincs részlet: a kézi pipálás marad érvényben
  const sum = list.reduce((s, p) => s + Number(p.amount), 0);
  const full = sum >= payableAmount(inv) - 0.5;
  const last = list.map((p) => p.paid_date as string).sort().at(-1)!;
  const update = full
    ? { paid_date: last, paid_amount: roundMoney(sum, inv.currency as Currency), ...(inv.direction === "in" ? { is_planned: false } : {}) }
    : { paid_date: null, paid_amount: null, bank_booked_date: null };
  const { error: upErr } = await supabase.from("finance_invoices").update({ ...update, updated_at: new Date().toISOString() }).eq("id", invoiceId);
  if (upErr) throw upErr;
}

export async function addPayment(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const invoiceId = str(formData, "invoice_id");
  const amount = parseAmount(formData.get("amount"));
  const day = str(formData, "paid_date");
  if (!UUID_RE.test(invoiceId)) throw new Error("Érvénytelen tétel");
  if (amount === null || amount <= 0) throw new Error("Add meg a befizetett összeget");
  const method = ["transfer", "card", "cash"].includes(str(formData, "payment_method")) ? str(formData, "payment_method") : "transfer";
  const supabase = await createClient();
  const { error } = await supabase.from("finance_payments").insert({
    agency_id: profile.agency_id,
    invoice_id: invoiceId,
    paid_date: DATE_RE.test(day) ? day : todayIso(),
    amount,
    payment_method: method,
    note: str(formData, "note") || null,
  });
  if (error) throw error;
  await recomputePaid(supabase, invoiceId);
  revalidate();
}

export async function deletePayment(id: string) {
  await requireOwnerOrAdmin();
  if (!UUID_RE.test(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("finance_payments").select("invoice_id").eq("id", id).maybeSingle();
  if (!data) return;
  const { error } = await supabase.from("finance_payments").delete().eq("id", id);
  if (error) throw error;
  const { count } = await supabase.from("finance_payments").select("id", { count: "exact", head: true }).eq("invoice_id", data.invoice_id);
  if (!count) {
    // az utolsó részlet is törölve: vissza nyitottra
    await supabase.from("finance_invoices").update({ paid_date: null, paid_amount: null, bank_booked_date: null }).eq("id", data.invoice_id);
  } else await recomputePaid(supabase, data.invoice_id as string);
  revalidate();
}

// ---------- sztornó ----------

/**
 * Sztornó számla rögzítése: az eredeti negatív párja, ami rá hivatkozik. Ha az eredetit még nem
 * fizették ki, mindkettő rendezett (nincs pénzmozgás); ha már kifizették, a sztornó nyitott marad
 * (a pénzt vissza kell adni / vissza kell kapni).
 */
export async function createStorno(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = str(formData, "invoice_id");
  const day = DATE_RE.test(str(formData, "issue_date")) ? str(formData, "issue_date") : todayIso();
  const number = str(formData, "invoice_number") || null;
  const back = str(formData, "return_to");
  if (!UUID_RE.test(id)) throw new Error("Érvénytelen tétel");
  const supabase = await createClient();
  const { data: orig, error } = await supabase.from("finance_invoices").select("*").eq("id", id).single();
  if (error) throw error;
  if (Number(orig.gross_amount) <= 0) throw new Error("Negatív vagy 0 Ft-os tételt nem lehet sztornózni");
  const { count } = await supabase.from("finance_invoices").select("id", { count: "exact", head: true }).eq("corrects_invoice_id", id).lt("gross_amount", 0);
  if (count) throw new Error("Ennek a tételnek már van sztornója");

  const wasPaid = Boolean(orig.paid_date);
  const payable = payableAmount(orig);
  const note = `${orig.invoice_number ?? "az eredeti tétel"} sztornója`;
  const copy: Record<string, unknown> = { ...orig };
  for (const k of ["id", "created_at", "updated_at", "created_by", "schedule_id", "szamlazz_requested_at", "cash_person_id", "payroll_kind", "person_id"]) delete copy[k];
  const { data: storno, error: insErr } = await supabase
    .from("finance_invoices")
    .insert({
      ...copy,
      corrects_invoice_id: id,
      is_planned: false,
      invoice_number: number,
      issue_date: day,
      fulfillment_date: day,
      due_date: day,
      net_amount: -Number(orig.net_amount),
      vat_amount: -Number(orig.vat_amount),
      gross_amount: -Number(orig.gross_amount),
      paid_date: wasPaid ? null : day,
      paid_amount: wasPaid ? null : -payable,
      bank_booked_date: null,
      notes: [note, wasPaid ? "az eredetit már kifizették — a visszafizetés még rendezendő" : ""].filter(Boolean).join("; "),
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  if (!wasPaid) {
    await supabase
      .from("finance_invoices")
      .update({ paid_date: day, paid_amount: payable, notes: [orig.notes, `sztornózva ${day}`].filter(Boolean).join("; "), updated_at: new Date().toISOString() })
      .eq("id", id);
  }
  revalidate();
  redirect(`/dashboard/finance/invoices/${storno.id}${back ? `?back=${encodeURIComponent(back)}` : ""}`);
}

/** Meglévő (pl. importált) negatív / helyesbítő tétel hozzákötése az eredetihez — vagy a kötés bontása. */
export async function linkCorrection(correctionId: string, originalId: string | null) {
  await requireOwnerOrAdmin();
  if (!UUID_RE.test(correctionId) || (originalId !== null && !UUID_RE.test(originalId))) throw new Error("Érvénytelen tétel");
  if (originalId === correctionId) throw new Error("Egy tétel nem javíthatja önmagát");
  const supabase = await createClient();
  const { error } = await supabase.from("finance_invoices").update({ corrects_invoice_id: originalId }).eq("id", correctionId);
  if (error) throw error;
  revalidate();
}

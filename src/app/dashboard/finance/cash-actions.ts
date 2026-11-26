"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { parseAmount, roundMoney, todayIso } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function revalidate() {
  revalidatePath("/dashboard/finance", "layout");
}

/** Kinél van / ki fizette — egy vagy több készpénzes tételhez egyszerre (null = nincs megadva). */
export async function assignCashPerson(invoiceIds: string[], personId: string | null) {
  await requireOwnerOrAdmin();
  const ids = invoiceIds.filter((id) => UUID_RE.test(id));
  if (!ids.length) return;
  if (personId !== null && !UUID_RE.test(personId)) throw new Error("Érvénytelen személy");
  const supabase = await createClient();
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("finance_invoices").update({ cash_person_id: personId }).in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
  revalidate();
}

/** Készpénz átadása két személy között (az egyik oldal lehet „máshonnan” / „elszámolva”). */
export async function createCashTransfer(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const from = String(formData.get("from_person_id") ?? "") || null;
  const to = String(formData.get("to_person_id") ?? "") || null;
  const rawDate = String(formData.get("transfer_date") ?? "");
  const amount = parseAmount(formData.get("amount"));
  if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
  if (!from && !to) throw new Error("Add meg, ki adta át vagy ki kapta");
  if (from && to && from === to) throw new Error("Az átadó és az átvevő nem lehet ugyanaz");
  if (amount === null || amount <= 0) throw new Error("Add meg az összeget");
  const supabase = await createClient();
  const { error } = await supabase.from("finance_cash_transfers").insert({
    agency_id: profile.agency_id,
    company_id: companyId,
    transfer_date: DATE_RE.test(rawDate) ? rawDate : todayIso(),
    amount: roundMoney(amount, "HUF"),
    currency: "HUF",
    from_person_id: from,
    to_person_id: to,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) throw error;
  revalidate();
}

export async function deleteCashTransfer(id: string) {
  await requireOwnerOrAdmin();
  if (!UUID_RE.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_cash_transfers").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

/** Új pénzkezelő (pl. tag, sofőr) gyors felvétele a cég személyei közé. */
export async function addCashPerson(companyId: string, name: string): Promise<string> {
  const profile = await requireOwnerOrAdmin();
  const clean = name.trim();
  if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
  if (!clean) throw new Error("Írd be a nevet");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_company_people")
    .insert({ agency_id: profile.agency_id, company_id: companyId, name: clean, role: "other", notes: "A Pénztár oldalon felvéve (készpénzkezelő)" })
    .select("id")
    .single();
  if (error) throw error;
  revalidate();
  return data.id as string;
}

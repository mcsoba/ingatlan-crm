"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { parseAmount } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Tényleges banki egyenleg rögzítése egy napra (ugyanarra a napra az új felülírja a régit). */
export async function saveBankBalance(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const day = String(formData.get("balance_date") ?? "");
  // negatív egyenleg is lehet (folyószámlahitel): a mínuszjelet a parseAmount nem dobja el
  const raw = String(formData.get("balance") ?? "").trim();
  const negative = /^[-−]/.test(raw);
  const amount = parseAmount(raw.replace(/^[-−]/, ""));
  if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
  if (!DATE_RE.test(day)) throw new Error("Add meg a dátumot");
  if (amount === null) throw new Error("Add meg az egyenleget");
  const supabase = await createClient();
  const { error } = await supabase.from("finance_bank_balances").upsert(
    {
      agency_id: profile.agency_id,
      company_id: companyId,
      balance_date: day,
      balance: negative ? -amount : amount,
      note: String(formData.get("note") ?? "").trim() || null,
    },
    { onConflict: "company_id,balance_date" },
  );
  if (error) throw error;
  revalidatePath("/dashboard/finance/cashflow");
}

export async function deleteBankBalance(id: string) {
  await requireOwnerOrAdmin();
  if (!UUID_RE.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_bank_balances").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/finance/cashflow");
}

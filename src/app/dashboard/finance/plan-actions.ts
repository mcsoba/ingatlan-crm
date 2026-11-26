"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { parseAmount } from "@/lib/finance";

const UUID_RE = /^[0-9a-f-]{36}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Kézi tervtétel egy hónapra (várható bevétel / kiadás, amihez még nincs számla vagy törzs). */
export async function addPlanItem(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = str(formData, "company_id");
  const month = str(formData, "month");
  const description = str(formData, "description");
  const amount = parseAmount(formData.get("amount"));
  const date = str(formData, "expected_date");
  if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Érvénytelen hónap");
  if (!description) throw new Error("Írd be, mi ez a tétel");
  if (amount === null || amount <= 0) throw new Error("Add meg az összeget");
  const supabase = await createClient();
  const { error } = await supabase.from("finance_plan_items").insert({
    agency_id: profile.agency_id,
    company_id: companyId,
    month: `${month}-01`,
    kind: str(formData, "kind") === "income" ? "income" : "expense",
    description,
    counterparty: str(formData, "counterparty") || null,
    amount,
    expected_date: /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(month) ? date : null,
    note: str(formData, "note") || null,
  });
  if (error) throw error;
  revalidatePath("/dashboard/finance/plan");
}

export async function deletePlanItem(id: string) {
  await requireOwnerOrAdmin();
  if (!UUID_RE.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_plan_items").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/finance/plan");
}

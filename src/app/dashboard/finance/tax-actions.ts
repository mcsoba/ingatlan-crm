"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { parseAmount, todayIso } from "@/lib/finance";
import { DEFAULT_TAX_OBLIGATIONS, isValidSchedule } from "@/lib/finance-tax";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function revalidate() {
  revalidatePath("/dashboard/finance", "layout");
}

/** Az alap adónaptár betöltése egy céghez (csak ha még nincs kötelezettsége). */
export async function loadDefaultTaxObligations(companyId: string) {
  const profile = await requireOwnerOrAdmin();
  if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
  const supabase = await createClient();
  const { count } = await supabase.from("finance_tax_obligations").select("id", { count: "exact", head: true }).eq("company_id", companyId);
  if (count) throw new Error("Ennek a cégnek már van adónaptára");
  const { error } = await supabase
    .from("finance_tax_obligations")
    .insert(DEFAULT_TAX_OBLIGATIONS.map((o, i) => ({ agency_id: profile.agency_id, company_id: companyId, ...o, sort_order: i })));
  if (error) throw error;
  revalidate();
}

/** Ütemezés az űrlapból: havi (nap) vagy évente fix napok („03-15, 09-15”). */
function scheduleFrom(fd: FormData): string {
  if (str(fd, "mode") === "monthly") return `monthly:${Number(str(fd, "day")) || 12}`;
  const dates = str(fd, "dates")
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((d) => {
      const m = d.replace(/\.$/, "").match(/^(\d{1,2})[.\-/](\d{1,2})$/);
      return m ? `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "?";
    });
  return `fixed:${dates.join(",")}`;
}

export async function saveTaxObligation(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = str(formData, "id");
  const companyId = str(formData, "company_id");
  const name = str(formData, "name");
  const schedule = scheduleFrom(formData);
  if (!name) throw new Error("Add meg a kötelezettség nevét");
  if (!isValidSchedule(schedule)) throw new Error("Érvénytelen határidő — havinál 1–28 közötti nap, évesnél pl. „03-15, 09-15”");
  const amount = str(formData, "amount") ? parseAmount(formData.get("amount")) : null;
  const row = {
    name,
    schedule,
    municipality: str(formData, "municipality") || null,
    amount,
    notes: str(formData, "notes") || null,
    active: str(formData, "active") !== "no",
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  if (UUID_RE.test(id)) {
    const { error } = await supabase.from("finance_tax_obligations").update(row).eq("id", id);
    if (error) throw error;
  } else {
    if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
    const { error } = await supabase.from("finance_tax_obligations").insert({ ...row, agency_id: profile.agency_id, company_id: companyId, sort_order: 100 });
    if (error) throw error;
  }
  revalidate();
}

export async function deleteTaxObligation(id: string) {
  await requireOwnerOrAdmin();
  if (!UUID_RE.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_tax_obligations").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

/** Esedékesség teljesítése (bevallva / befizetve) — vagy visszavonása (done = false). */
export async function setTaxDone(obligationId: string, nominalDate: string, done: boolean, amountRaw?: string, note?: string) {
  const profile = await requireOwnerOrAdmin();
  if (!UUID_RE.test(obligationId) || !DATE_RE.test(nominalDate)) throw new Error("Érvénytelen esedékesség");
  const supabase = await createClient();
  if (!done) {
    const { error } = await supabase.from("finance_tax_tasks").delete().eq("obligation_id", obligationId).eq("due_date", nominalDate);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("finance_tax_tasks").upsert(
      {
        agency_id: profile.agency_id,
        obligation_id: obligationId,
        due_date: nominalDate,
        done_at: todayIso(),
        amount: amountRaw ? parseAmount(amountRaw) : null,
        note: note?.trim() || null,
      },
      { onConflict: "obligation_id,due_date" },
    );
    if (error) throw error;
  }
  revalidate();
}

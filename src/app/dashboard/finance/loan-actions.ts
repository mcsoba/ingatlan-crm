"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { parseAmount, roundMoney, todayIso } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/**
 * Tagi kölcsön mozgása: a cég kölcsönt ad a tagnak (kiadás → a tag tartozása nő),
 * vagy a tag visszafizeti (bevétel → a tartozás csökken). Rendes tételként kerül a
 * nyilvántartásba („Tagi kölcsön” kategória), a taghoz kötve (person_id).
 */
export async function createLoanMove(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = str(formData, "company_id");
  const kind = str(formData, "kind") === "repay" ? "repay" : "lend";
  let personId = str(formData, "person_id");
  const newName = str(formData, "new_name");
  const amount = parseAmount(formData.get("amount"));
  const day = DATE_RE.test(str(formData, "date")) ? str(formData, "date") : todayIso();
  const method = str(formData, "payment_method") === "cash" ? "cash" : "transfer";
  if (!UUID_RE.test(companyId)) throw new Error("Válaszd ki a céget");
  if (amount === null || amount <= 0) throw new Error("Add meg az összeget");
  const supabase = await createClient();

  if (!personId && newName) {
    const { data, error } = await supabase
      .from("finance_company_people")
      .insert({ agency_id: profile.agency_id, company_id: companyId, name: newName, role: "owner" })
      .select("id")
      .single();
    if (error) throw error;
    personId = data.id as string;
  }
  if (!UUID_RE.test(personId)) throw new Error("Válaszd ki a tagot (vagy írd be az új tag nevét)");
  const { data: person, error: pErr } = await supabase.from("finance_company_people").select("name").eq("id", personId).single();
  if (pErr) throw pErr;

  const gross = roundMoney(amount, "HUF");
  const { error } = await supabase.from("finance_invoices").insert({
    agency_id: profile.agency_id,
    company_id: companyId,
    direction: kind === "lend" ? "in" : "out",
    doc_type: "none",
    category: "loan",
    counterparty_name: person.name,
    person_id: personId,
    description: kind === "lend" ? "tagi kölcsön" : "tagi kölcsön visszafizetése",
    issue_date: day,
    fulfillment_date: day,
    due_date: day,
    paid_date: day,
    paid_amount: gross,
    payment_method: method,
    currency: "HUF",
    net_amount: gross,
    vat_rate: null,
    vat_amount: 0,
    gross_amount: gross,
    notes: str(formData, "note") || null,
  });
  if (error) throw error;
  revalidatePath("/dashboard/finance", "layout");
}

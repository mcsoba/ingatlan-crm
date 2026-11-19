"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import {
  PAYROLL_KINDS,
  PAYROLL_KIND_LABELS,
  PAYROLL_SELECT,
  daysInMonth,
  parseAmount,
  payrollDueDate,
  roundMoney,
  type PayrollKind,
  type PayrollRow,
} from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function date(fd: FormData, key: string): string | null {
  const v = text(fd, key);
  return v && DATE_RE.test(v) ? v : null;
}

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

/**
 * Egy cég egy havi bérlistájának mentése egyben. Sorkulcs: `wage:<személy id>`
 * vagy `tax:<fajta>`. Üres összeg = a sor törlése (ha volt). Minden sor egy
 * pénzügyi tétel (bejövő / nekünk kell fizetni, bizonylat nélkül).
 */
export async function savePayrollMonth(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = text(formData, "company_id");
  const month = text(formData, "month");
  if (!companyId) throw new Error("Válaszd ki a céget");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Hiányzik a hónap");
  const [y, m] = month.split("-").map(Number);
  const periodStart = `${month}-01`;
  const periodEnd = `${month}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
  const monthLabel = `${y}. ${MONTH_NAMES[m - 1]}`;

  const supabase = await createClient();
  const [{ data: existingRows, error }, { data: people }] = await Promise.all([
    supabase
      .from("finance_invoices")
      .select(PAYROLL_SELECT)
      .eq("company_id", companyId)
      .eq("period_start", periodStart)
      .not("payroll_kind", "is", null),
    supabase.from("finance_company_people").select("id, name").eq("company_id", companyId),
  ]);
  if (error) throw error;
  const existing = new Map(
    ((existingRows ?? []) as PayrollRow[]).map((r) => [r.payroll_kind === "wage" ? `wage:${r.person_id}` : `tax:${r.payroll_kind}`, r]),
  );
  const personName = new Map((people ?? []).map((p) => [p.id as string, p.name as string]));

  const toDelete: string[] = [];
  for (const key of formData.getAll("keys").map(String)) {
    const [type, ref] = key.split(":");
    const kind = (type === "wage" ? "wage" : ref) as PayrollKind;
    if (!PAYROLL_KINDS.includes(kind)) continue;
    const personId = type === "wage" ? ref : null;
    if (personId && !personName.has(personId)) continue;

    const amountRaw = parseAmount(formData.get(`amount__${key}`));
    const current = existing.get(key);
    if (amountRaw === null || amountRaw <= 0) {
      if (current) toDelete.push(current.id);
      continue;
    }
    const amount = roundMoney(amountRaw, "HUF");
    const paidDate = date(formData, `paid__${key}`);
    const dueDate = date(formData, `due__${key}`) ?? payrollDueDate(kind, month);
    const payload = {
      company_id: companyId,
      direction: "in",
      doc_type: "none",
      category: kind === "wage" || kind === "efo" ? "salary" : "tax",
      is_planned: false,
      payroll_kind: kind,
      person_id: personId,
      counterparty_name: personId ? personName.get(personId)! : kind === "efo" ? "EFO — alkalmi munkavállalók" : "NAV",
      description: personId ? `Munkabér — ${monthLabel}` : `${PAYROLL_KIND_LABELS[kind]} — ${monthLabel}`,
      period_start: periodStart,
      period_end: periodEnd,
      issue_date: periodEnd,
      fulfillment_date: periodEnd,
      due_date: dueDate,
      paid_date: paidDate,
      paid_amount: paidDate ? amount : null,
      payment_method: "transfer",
      currency: "HUF",
      net_amount: amount,
      vat_rate: null,
      vat_amount: 0,
      gross_amount: amount,
      notes: text(formData, `note__${key}`),
      updated_at: new Date().toISOString(),
    };
    const { error: writeError } = current
      ? await supabase.from("finance_invoices").update(payload).eq("id", current.id)
      : await supabase.from("finance_invoices").insert({ ...payload, agency_id: profile.agency_id });
    if (writeError) throw writeError;
  }

  if (toDelete.length) {
    const { error: deleteError } = await supabase.from("finance_invoices").delete().in("id", toDelete);
    if (deleteError) throw deleteError;
  }

  revalidatePath("/dashboard/finance", "layout");
  revalidatePath("/dashboard");
  redirect(`/dashboard/finance/payroll?company=${companyId}&month=${month}&saved=1`);
}

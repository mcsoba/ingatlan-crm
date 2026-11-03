"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import {
  CATEGORIES,
  computeGross,
  parseAmount,
  payableAmount,
  roundMoney,
  todayIso,
  type Currency,
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

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function vatRate(fd: FormData): number | null {
  const v = text(fd, "vat_rate");
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function revalidateFinance() {
  revalidatePath("/dashboard/finance", "layout");
  revalidatePath("/dashboard");
}

/** Visszaút a listára a szűrők megtartásával (a form `return_to` mezőjéből, csak belső útvonal). */
function returnTo(fd: FormData, fallback: string): string {
  const v = text(fd, "return_to");
  return v && v.startsWith("/dashboard/finance") ? v : fallback;
}

// ---------- cégek ----------

export async function saveCompany(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) throw new Error("Add meg a cég nevét");
  const payload = {
    name,
    tax_number: text(formData, "tax_number"),
    address: text(formData, "address"),
    bank_account: text(formData, "bank_account"),
    color: text(formData, "color"),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("finance_companies").update(payload).eq("id", id)
    : await supabase.from("finance_companies").insert({ ...payload, agency_id: profile.agency_id });
  if (error) throw error;
  revalidateFinance();
}

export async function deleteCompany(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { count } = await supabase
    .from("finance_invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id);
  if (count) {
    throw new Error(`A cégnek ${count} rögzített tétele van — előbb azokat kell törölni vagy másik céghez rendelni.`);
  }
  const { error } = await supabase.from("finance_companies").delete().eq("id", id);
  if (error) throw error;
  revalidateFinance();
}

// ---------- számlák / tételek ----------

export async function saveInvoice(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const currency = oneOf<Currency>(text(formData, "currency"), ["HUF", "EUR"], "HUF");
  const direction = oneOf(text(formData, "direction"), ["out", "in"] as const, "in");
  const companyId = text(formData, "company_id");
  const counterparty = text(formData, "counterparty_name");
  const description = text(formData, "description");
  const issueDate = date(formData, "issue_date");
  if (!companyId) throw new Error("Válaszd ki a céget");
  if (!counterparty) throw new Error(direction === "out" ? "Add meg a vevőt" : "Add meg a kiállítót / partnert");
  if (!description) throw new Error("Add meg a tételt (számla tartalma)");
  if (!issueDate) throw new Error("Add meg a kelte / dátum mezőt");

  const net = roundMoney(parseAmount(formData.get("net_amount")) ?? 0, currency);
  const rate = vatRate(formData);
  const computed = computeGross(net, rate, currency);
  // A bruttó kézzel felülírható (pl. kerekítés a kapott számlán)
  const grossInput = parseAmount(formData.get("gross_amount"));
  const gross = grossInput !== null ? roundMoney(grossInput, currency) : computed.gross;
  const vat = grossInput !== null ? roundMoney(gross - net, currency) : computed.vat;
  const paidAmount = parseAmount(formData.get("paid_amount"));
  const invoiceNumber = text(formData, "invoice_number");

  const payload = {
    company_id: companyId,
    direction,
    doc_type: oneOf(text(formData, "doc_type"), ["invoice", "proforma", "none"] as const, "invoice"),
    category: oneOf(text(formData, "category"), CATEGORIES.map((c) => c.value), "other"),
    invoice_number: invoiceNumber,
    // Számlaszám megadásával a tervezett tétel kiállítottá válik
    is_planned: formData.get("is_planned") === "1" && !invoiceNumber,
    counterparty_name: counterparty,
    counterparty_tax_number: text(formData, "counterparty_tax_number"),
    property_id: text(formData, "property_id"),
    location: text(formData, "location"),
    description,
    period_start: date(formData, "period_start"),
    period_end: date(formData, "period_end"),
    issue_date: issueDate,
    fulfillment_date: date(formData, "fulfillment_date"),
    due_date: date(formData, "due_date"),
    paid_date: date(formData, "paid_date"),
    bank_booked_date: date(formData, "bank_booked_date"),
    payment_method: oneOf(text(formData, "payment_method"), ["transfer", "card", "cash"] as const, "transfer"),
    currency,
    net_amount: net,
    vat_rate: rate,
    vat_amount: vat,
    gross_amount: gross,
    szja_withheld: direction === "in" && formData.get("szja_withheld") === "on",
    paid_amount: paidAmount === null ? null : roundMoney(paidAmount, currency),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("finance_invoices").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("finance_invoices").insert({ ...payload, agency_id: profile.agency_id });
    if (error) throw error;
  }
  revalidateFinance();
  redirect(returnTo(formData, `/dashboard/finance/invoices?dir=${direction}`));
}

export async function deleteInvoice(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_invoices").delete().eq("id", id);
  if (error) throw error;
  revalidateFinance();
  redirect(returnTo(formData, "/dashboard/finance/invoices"));
}

/**
 * Gyors „pipálás” a listából / adatlapról, ahogy eddig az Excelben:
 * - paid: kifizetés dátuma (alapból ma), a ténylegesen fizetett összeg alapból a fizetendő
 * - booked: banki könyvelés dátuma (ha még nincs kifizetés, azt is beírja)
 * - issued: számlaszám megadásával a tervezett tétel kiállított lesz
 * - undo_paid / undo_booked: visszavonás
 */
export async function markInvoice(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const action = text(formData, "action");
  if (!id || !action) return;
  const day = date(formData, "date") ?? todayIso();
  const supabase = await createClient();

  const { data: inv, error: loadError } = await supabase
    .from("finance_invoices")
    .select("gross_amount, szja_withheld, currency, paid_date, paid_amount")
    .eq("id", id)
    .single();
  if (loadError) throw loadError;

  let update: Record<string, unknown>;
  switch (action) {
    case "paid":
      update = { paid_date: day, paid_amount: inv.paid_amount ?? payableAmount(inv) };
      break;
    case "booked":
      update = {
        bank_booked_date: day,
        ...(inv.paid_date ? {} : { paid_date: day, paid_amount: inv.paid_amount ?? payableAmount(inv) }),
      };
      break;
    case "issued": {
      const number = text(formData, "invoice_number");
      if (!number) throw new Error("Írd be a Számlázz.hu-n kapott számlaszámot");
      update = { invoice_number: number, is_planned: false, issue_date: day };
      break;
    }
    case "undo_paid":
      update = { paid_date: null, paid_amount: null, bank_booked_date: null };
      break;
    case "undo_booked":
      update = { bank_booked_date: null };
      break;
    default:
      return;
  }
  const { error } = await supabase
    .from("finance_invoices")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidateFinance();
}

// ---------- számla-törzsek (ismétlődő tételek) ----------

export async function saveSchedule(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const currency = oneOf<Currency>(text(formData, "currency"), ["HUF", "EUR"], "HUF");
  const direction = oneOf(text(formData, "direction"), ["out", "in"] as const, "out");
  const companyId = text(formData, "company_id");
  const counterparty = text(formData, "counterparty_name");
  const description = text(formData, "description");
  const startDate = date(formData, "start_date");
  const endDate = date(formData, "end_date");
  const net = parseAmount(formData.get("net_amount"));
  if (!companyId) throw new Error("Válaszd ki a céget");
  if (!counterparty) throw new Error("Add meg a partnert");
  if (!description) throw new Error("Add meg a számla tartalmát");
  if (!startDate) throw new Error("Add meg a szerződés / számlázás kezdetét");
  if (endDate && endDate < startDate) throw new Error("A vége nem lehet a kezdet előtt");
  if (net === null || net < 0) throw new Error("Add meg az összeget (nettó / időszak)");

  const int = (key: string, fallback: number, min: number, max: number) => {
    const n = Math.round(Number(text(formData, key) ?? fallback));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  // Ettől az időszaktól készüljenek tételek (régi szerződésnél ne pótoljon visszamenőleg)
  const firstPeriod = date(formData, "first_period");
  const nextPeriod = firstPeriod && firstPeriod > startDate ? firstPeriod : startDate;

  const payload = {
    company_id: companyId,
    direction,
    doc_type: oneOf(text(formData, "doc_type"), ["invoice", "proforma", "none"] as const, "invoice"),
    category: oneOf(text(formData, "category"), CATEGORIES.map((c) => c.value), "rent"),
    counterparty_name: counterparty,
    counterparty_tax_number: text(formData, "counterparty_tax_number"),
    property_id: text(formData, "property_id"),
    location: text(formData, "location"),
    description,
    currency,
    net_amount: roundMoney(net, currency),
    vat_rate: vatRate(formData),
    szja_withheld: direction === "in" && formData.get("szja_withheld") === "on",
    payment_method: oneOf(text(formData, "payment_method"), ["transfer", "card", "cash"] as const, "transfer"),
    frequency: oneOf(text(formData, "frequency"), ["monthly", "quarterly", "yearly", "once"] as const, "monthly"),
    start_date: startDate,
    end_date: endDate,
    issue_day: int("issue_day", 1, 1, 28),
    payment_days: int("payment_days", 8, 0, 120),
    prorate: formData.get("prorate") === "on",
    lead_days: int("lead_days", 7, 0, 60),
    active: formData.get("active") !== "off",
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (id) {
    // A kurzort csak akkor írjuk át, ha a felhasználó kifejezetten megadta a kezdő időszakot
    const { error } = await supabase
      .from("finance_schedules")
      .update(firstPeriod ? { ...payload, next_period_start: nextPeriod } : payload)
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("finance_schedules")
      .insert({ ...payload, agency_id: profile.agency_id, next_period_start: nextPeriod });
    if (error) throw error;
  }
  revalidateFinance();
  redirect(returnTo(formData, "/dashboard/finance/schedules"));
}

export async function deleteSchedule(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  // A már létrehozott, még ki nem állított tételei is törlődnek; a kiállítottak megmaradnak
  await supabase.from("finance_invoices").delete().eq("schedule_id", id).eq("is_planned", true);
  const { error } = await supabase.from("finance_schedules").delete().eq("id", id);
  if (error) throw error;
  revalidateFinance();
  redirect("/dashboard/finance/schedules");
}

export async function toggleSchedule(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_schedules")
    .update({ active: formData.get("active") === "1", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidateFinance();
}

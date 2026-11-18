"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { resolvePartner, type Supabase } from "@/lib/finance-partners";
import { addDays, parseAmount, todayIso, type LeaseFrequency } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;

function text(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function date(fd: FormData, key: string): string | null {
  const v = text(fd, key);
  return v && DATE_RE.test(v) ? v : null;
}

function money(fd: FormData, key: string): number | null {
  const n = parseAmount(fd.get(key));
  return n === null || n < 0 ? null : Math.round(n);
}

function int(fd: FormData, key: string): number | null {
  const n = parseAmount(fd.get(key));
  return n === null || n < 0 ? null : Math.round(n);
}

function frequency(fd: FormData, key: string): LeaseFrequency {
  const v = text(fd, key);
  return FREQUENCIES.includes(v as LeaseFrequency) ? (v as LeaseFrequency) : "monthly";
}

function revalidate() {
  revalidatePath("/dashboard/finance", "layout");
}

// ---------- partnerek ----------

export async function savePartner(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) throw new Error("Add meg a partner nevét");
  const payload = {
    name,
    kind: text(formData, "kind") === "person" ? "person" : "company",
    is_landlord: formData.get("is_landlord") === "on",
    is_tenant: formData.get("is_tenant") === "on",
    tax_number: text(formData, "tax_number"),
    address: text(formData, "address"),
    bank_account: text(formData, "bank_account"),
    contact_name: text(formData, "contact_name"),
    contact_email: text(formData, "contact_email"),
    contact_phone: text(formData, "contact_phone"),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  let partnerId = id;
  if (id) {
    const { error } = await supabase.from("finance_partners").update(payload).eq("id", id);
    if (error) throw error;
    // A partnerhez kötött, még ki nem állított tételek az új adatokat kapják
    await supabase
      .from("finance_invoices")
      .update({ counterparty_name: name, counterparty_tax_number: payload.tax_number })
      .eq("partner_id", id)
      .eq("is_planned", true);
    await supabase.from("finance_schedules").update({ counterparty_name: name, counterparty_tax_number: payload.tax_number }).eq("partner_id", id);
  } else {
    const { data, error } = await supabase
      .from("finance_partners")
      .insert({ ...payload, agency_id: profile.agency_id })
      .select("id")
      .single();
    if (error) throw error;
    partnerId = data.id;
  }
  revalidate();
  redirect(`/dashboard/finance/partners/${partnerId}?saved=1`);
}

export async function deletePartner(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  // A szállások és számlák megmaradnak, csak a partner-kapcsolat törlődik (on delete set null)
  const { error } = await supabase.from("finance_partners").delete().eq("id", id);
  if (error) throw error;
  revalidate();
  redirect("/dashboard/finance/partners");
}

// ---------- szállások ----------

export async function saveLodging(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const address = text(formData, "address");
  if (!address) throw new Error("Add meg a szállás címét");
  const supabase = await createClient();

  const landlord = await resolvePartner(supabase, profile.agency_id, text(formData, "landlord_name"), "landlord");
  const tenant = await resolvePartner(supabase, profile.agency_id, text(formData, "tenant_name"), "tenant");

  const leaseStart = date(formData, "lease_start");
  const leaseEnd = date(formData, "lease_end");
  const subStart = date(formData, "sublease_start");
  const subEnd = date(formData, "sublease_end");
  if (leaseStart && leaseEnd && leaseEnd < leaseStart) throw new Error("A bérlés vége nem lehet a kezdete előtt");
  if (subStart && subEnd && subEnd < subStart) throw new Error("A továbbadás vége nem lehet a kezdete előtt");

  const payload = {
    company_id: text(formData, "company_id"),
    address,
    area_sqm: parseAmount(formData.get("area_sqm")),
    capacity: int(formData, "capacity"),
    occupants: int(formData, "occupants"),
    landlord_id: landlord?.id ?? null,
    lease_signed_date: date(formData, "lease_signed_date"),
    lease_handover_date: date(formData, "lease_handover_date"),
    lease_start: leaseStart,
    lease_end: leaseEnd,
    lease_fee: money(formData, "lease_fee"),
    lease_frequency: frequency(formData, "lease_frequency"),
    lease_deposit: money(formData, "lease_deposit"),
    lease_includes: text(formData, "lease_includes"),
    lease_terms: text(formData, "lease_terms"),
    lease_extension: text(formData, "lease_extension"),
    tenant_id: tenant?.id ?? null,
    sublease_signed_date: date(formData, "sublease_signed_date"),
    sublease_start: subStart,
    sublease_end: subEnd,
    sublease_fee: money(formData, "sublease_fee"),
    sublease_frequency: frequency(formData, "sublease_frequency"),
    sublease_deposit: money(formData, "sublease_deposit"),
    sublease_includes: text(formData, "sublease_includes"),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  let lodgingId = id;
  if (id) {
    const { error } = await supabase.from("finance_lodgings").update(payload).eq("id", id);
    if (error) throw error;
    // A szálláshoz kötött törzsek és még ki nem állított tételek címe kövesse a módosítást
    await supabase.from("finance_schedules").update({ location: address }).eq("lodging_id", id);
    await supabase.from("finance_invoices").update({ location: address }).eq("lodging_id", id).eq("is_planned", true);
  } else {
    const { data, error } = await supabase
      .from("finance_lodgings")
      .insert({ ...payload, agency_id: profile.agency_id })
      .select("id")
      .single();
    if (error) throw error;
    lodgingId = data.id;
  }
  revalidate();
  redirect(`/dashboard/finance/lodgings/${lodgingId}?saved=1`);
}

export async function deleteLodging(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_lodgings").delete().eq("id", id);
  if (error) throw error;
  revalidate();
  redirect("/dashboard/finance/lodgings");
}

async function loadLodgingWithPartners(supabase: Supabase, id: string) {
  const { data: lodging, error } = await supabase.from("finance_lodgings").select("*").eq("id", id).single();
  if (error) throw error;
  const ids = [lodging.landlord_id, lodging.tenant_id].filter(Boolean) as string[];
  const { data: partners } = ids.length
    ? await supabase.from("finance_partners").select("id, name, kind, tax_number").in("id", ids)
    : { data: [] };
  const byId = new Map((partners ?? []).map((p) => [p.id as string, p]));
  return {
    lodging,
    landlord: lodging.landlord_id ? byId.get(lodging.landlord_id) : undefined,
    tenant: lodging.tenant_id ? byId.get(lodging.tenant_id) : undefined,
  };
}

/**
 * Ismétlődő számla-törzs a szállás szerződéséből: „lease” = a bérbeadónak
 * fizetett díj (bejövő), „sublease” = a bérlőnek kiszámlázott díj (kimenő).
 * Ha már van ilyen törzs, azt nyitja meg. Létrehozás után az adatlapra visz
 * ellenőrzésre (ÁFA, kiállítási nap).
 */
export async function createLodgingSchedule(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const side = text(formData, "side") === "sublease" ? "sublease" : "lease";
  if (!id) return;
  const supabase = await createClient();
  const direction = side === "lease" ? "in" : "out";

  const { data: existing } = await supabase
    .from("finance_schedules")
    .select("id")
    .eq("lodging_id", id)
    .eq("direction", direction)
    .eq("category", "rent")
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/dashboard/finance/schedules/${existing.id}`);

  const { lodging, landlord, tenant } = await loadLodgingWithPartners(supabase, id);
  const partner = side === "lease" ? landlord : tenant;
  const fee = side === "lease" ? lodging.lease_fee : lodging.sublease_fee;
  const start = (side === "lease" ? lodging.lease_start : lodging.sublease_start) ?? todayIso();
  const end = side === "lease" ? lodging.lease_end : lodging.sublease_end;
  if (!partner) throw new Error(side === "lease" ? "Előbb add meg a bérbeadót" : "Előbb add meg, kinek adjuk tovább (bérlő)");
  if (fee === null) throw new Error("Előbb add meg a díjat");
  if (!lodging.company_id) throw new Error("Előbb válaszd ki, melyik cégünk béreli a szállást");

  // Régi szerződésnél ne készüljenek visszamenőleges tételek: az aktuális hónaptól indul
  const thisMonth = `${todayIso().slice(0, 7)}-01`;
  const isPerson = partner.kind === "person";
  const { data, error } = await supabase
    .from("finance_schedules")
    .insert({
      agency_id: profile.agency_id,
      company_id: lodging.company_id,
      direction,
      doc_type: side === "lease" && isPerson ? "none" : "invoice",
      category: "rent",
      counterparty_name: partner.name,
      counterparty_tax_number: partner.tax_number,
      partner_id: partner.id,
      lodging_id: id,
      location: lodging.address,
      description: "Ingatlan bérleti díj",
      currency: "HUF",
      net_amount: fee,
      vat_rate: side === "sublease" ? 0 : null,
      szja_withheld: side === "lease" && isPerson,
      payment_method: "transfer",
      frequency: side === "lease" ? lodging.lease_frequency : lodging.sublease_frequency,
      start_date: start,
      end_date: end,
      issue_day: 1,
      payment_days: side === "lease" ? 10 : 8,
      prorate: true,
      lead_days: 7,
      active: true,
      next_period_start: start > thisMonth ? start : thisMonth,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidate();
  redirect(`/dashboard/finance/schedules/${data.id}?from_lodging=1`);
}

/** Kaució tétel a szállás szerződéséből (bejövő: amit mi fizettünk / kimenő: amit a bérlő fizet nekünk). */
export async function createLodgingDeposit(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const side = text(formData, "side") === "sublease" ? "sublease" : "lease";
  if (!id) return;
  const supabase = await createClient();
  const direction = side === "lease" ? "in" : "out";

  const { data: existing } = await supabase
    .from("finance_invoices")
    .select("id")
    .eq("lodging_id", id)
    .eq("direction", direction)
    .eq("category", "deposit")
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/dashboard/finance/invoices/${existing.id}`);

  const { lodging, landlord, tenant } = await loadLodgingWithPartners(supabase, id);
  const partner = side === "lease" ? landlord : tenant;
  const amount = side === "lease" ? lodging.lease_deposit : lodging.sublease_deposit;
  if (!partner) throw new Error(side === "lease" ? "Előbb add meg a bérbeadót" : "Előbb add meg a bérlőt");
  if (amount === null) throw new Error("Előbb add meg a kaució összegét");
  if (!lodging.company_id) throw new Error("Előbb válaszd ki, melyik cégünk béreli a szállást");
  const issue = (side === "lease" ? lodging.lease_signed_date : lodging.sublease_signed_date) ?? todayIso();

  const { data, error } = await supabase
    .from("finance_invoices")
    .insert({
      agency_id: profile.agency_id,
      company_id: lodging.company_id,
      direction,
      doc_type: side === "lease" ? "none" : "proforma",
      // A bérlőnek szóló díjbekérőt még ki kell állítani (Számlázz.hu panel)
      is_planned: side === "sublease",
      category: "deposit",
      counterparty_name: partner.name,
      counterparty_tax_number: partner.tax_number,
      partner_id: partner.id,
      lodging_id: id,
      location: lodging.address,
      description: "Ingatlan kaució",
      issue_date: issue,
      fulfillment_date: issue,
      due_date: addDays(issue, 10),
      payment_method: "transfer",
      currency: "HUF",
      net_amount: amount,
      vat_rate: null,
      vat_amount: 0,
      gross_amount: amount,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidate();
  redirect(`/dashboard/finance/invoices/${data.id}`);
}

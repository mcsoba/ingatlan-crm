"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { COMPANY_PERSON_ROLES, type CompanyPersonRole } from "@/lib/finance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_BUCKET = "finance-receipts";

function text(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function date(fd: FormData, key: string): string | null {
  const v = text(fd, key);
  return v && DATE_RE.test(v) ? v : null;
}

function revalidateCompany(id?: string) {
  // A cégnév / szín az oldalsáv cégválasztójában és minden listán megjelenik
  revalidatePath("/dashboard", "layout");
  if (id) revalidatePath(`/dashboard/finance/companies/${id}`);
}

// ---------- cégadatok ----------

export async function saveCompanyDetails(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) throw new Error("Add meg a cég nevét");
  const iban = text(formData, "iban")?.replace(/\s+/g, "").toUpperCase() ?? null;
  const payload = {
    name,
    color: text(formData, "color"),
    tax_number: text(formData, "tax_number"),
    eu_vat_number: text(formData, "eu_vat_number"),
    registration_number: text(formData, "registration_number"),
    founded_date: date(formData, "founded_date"),
    main_activity: text(formData, "main_activity"),
    address: text(formData, "address"),
    office_address: text(formData, "office_address"),
    mailing_address: text(formData, "mailing_address"),
    bank_name: text(formData, "bank_name"),
    bank_account: text(formData, "bank_account"),
    iban,
    swift: text(formData, "swift")?.toUpperCase() ?? null,
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    website: text(formData, "website"),
    accountant: text(formData, "accountant"),
    notes: text(formData, "notes"),
  };
  const supabase = await createClient();
  let companyId = id;
  if (id) {
    const { error } = await supabase.from("finance_companies").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("finance_companies")
      .insert({ ...payload, agency_id: profile.agency_id })
      .select("id")
      .single();
    if (error) throw error;
    companyId = data.id as string;
  }
  revalidateCompany(companyId ?? undefined);
  redirect(`/dashboard/finance/companies/${companyId}?saved=1`);
}

// ---------- személyek (ügyvezető, tag, munkatárs, könyvelő) ----------

export async function saveCompanyPerson(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const companyId = text(formData, "company_id");
  if (!companyId) throw new Error("Hiányzik a cég");
  const supabase = await createClient();

  // Ha CRM-felhasználót választottak, a név / e-mail / telefon onnan jön (ha üresen hagyták)
  const profileId = text(formData, "profile_id");
  let fallback: { full_name: string | null; phone: string | null } | null = null;
  if (profileId) {
    const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", profileId).maybeSingle();
    fallback = data;
  }
  const name = text(formData, "name") ?? fallback?.full_name ?? null;
  if (!name) throw new Error("Add meg a személy nevét");
  const role = text(formData, "role") as CompanyPersonRole | null;
  const ownership = Number(String(formData.get("ownership_percent") ?? "").replace(",", "."));

  const payload = {
    company_id: companyId,
    profile_id: profileId,
    name,
    role: role && COMPANY_PERSON_ROLES.includes(role) ? role : "employee",
    position: text(formData, "position"),
    email: text(formData, "email"),
    phone: text(formData, "phone") ?? fallback?.phone ?? null,
    birth_name: text(formData, "birth_name"),
    birth_place: text(formData, "birth_place"),
    birth_date: date(formData, "birth_date"),
    mother_name: text(formData, "mother_name"),
    address: text(formData, "address"),
    tax_id: text(formData, "tax_id"),
    ownership_percent: text(formData, "ownership_percent") && Number.isFinite(ownership) ? ownership : null,
    start_date: date(formData, "start_date"),
    end_date: date(formData, "end_date"),
    notes: text(formData, "notes"),
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("finance_company_people").update(payload).eq("id", id)
    : await supabase.from("finance_company_people").insert({ ...payload, agency_id: profile.agency_id });
  if (error) throw error;

  // A CRM-felhasználót a cég munkatársai közé is felvesszük (szűrők, szabadság)
  if (profileId) await addProfileToCompany(profile.agency_id, profileId, companyId);

  revalidateCompany(companyId);
  redirect(`/dashboard/finance/companies/${companyId}?person_saved=1#szemelyek`);
}

export async function deleteCompanyPerson(formData: FormData) {
  await requireOwnerOrAdmin();
  const id = text(formData, "id");
  const companyId = text(formData, "company_id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("finance_company_people").delete().eq("id", id);
  if (error) throw error;
  revalidateCompany(companyId ?? undefined);
  if (companyId) redirect(`/dashboard/finance/companies/${companyId}#szemelyek`);
}

// ---------- CRM-felhasználók hozzárendelése (profiles.company_ids) ----------

async function addProfileToCompany(agencyId: string, profileId: string, companyId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("agency_id, company_ids").eq("id", profileId).maybeSingle();
  if (!data || data.agency_id !== agencyId) return;
  const ids = (data.company_ids ?? []) as string[];
  if (ids.includes(companyId)) return;
  await admin.from("profiles").update({ company_ids: [...ids, companyId] }).eq("id", profileId);
}

/** A cég CRM-felhasználóinak beállítása (pipák) — a Csapat oldal cégválasztójával egyezik. */
export async function setCompanyMembers(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const companyId = text(formData, "company_id");
  if (!companyId) return;
  const selected = new Set(formData.getAll("member").map(String));

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from("profiles")
    .select("id, company_ids")
    .eq("agency_id", profile.agency_id);
  if (error) throw error;

  for (const m of members ?? []) {
    const ids = (m.company_ids ?? []) as string[];
    const has = ids.includes(companyId);
    const want = selected.has(m.id as string);
    if (has === want) continue;
    const next = want ? [...ids, companyId] : ids.filter((x) => x !== companyId);
    const { error: updateError } = await admin.from("profiles").update({ company_ids: next }).eq("id", m.id);
    if (updateError) throw updateError;
  }

  revalidateCompany(companyId);
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/leave");
  redirect(`/dashboard/finance/companies/${companyId}?members_saved=1#munkatarsak`);
}

// ---------- dokumentumok / fotók ----------

/**
 * A böngésző a fájlt közvetlenül a tárhelyre tölti fel (a szerverműveletek
 * ~1 MB-os kéréskorlátja miatt), utána ezzel rögzítjük a céghez.
 */
export async function recordCompanyFile(input: {
  companyId: string;
  path: string;
  filename: string;
  size: number;
  contentType: string | null;
}) {
  const profile = await requireOwnerOrAdmin();
  if (!input.path.startsWith(`${profile.agency_id}/companies/${input.companyId}/`)) {
    throw new Error("Érvénytelen fájlútvonal");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("finance_company_files").insert({
    agency_id: profile.agency_id,
    company_id: input.companyId,
    path: input.path,
    filename: input.filename.slice(0, 200),
    size_bytes: input.size,
    content_type: input.contentType,
  });
  if (error) {
    await supabase.storage.from(FILE_BUCKET).remove([input.path]);
    throw error;
  }
  revalidateCompany(input.companyId);
}

export async function deleteCompanyFile(id: string) {
  await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("finance_company_files").select("path, company_id").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase.storage.from(FILE_BUCKET).remove([data.path]);
  const { error } = await supabase.from("finance_company_files").delete().eq("id", id);
  if (error) throw error;
  revalidateCompany(data.company_id as string);
}

export async function getCompanyFileUrl(id: string): Promise<string> {
  await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("finance_company_files").select("path").eq("id", id).maybeSingle();
  if (!row) throw new Error("A fájl nem található");
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(row.path, 120);
  if (error || !data) throw new Error("Nem sikerült megnyitni a fájlt");
  return data.signedUrl;
}

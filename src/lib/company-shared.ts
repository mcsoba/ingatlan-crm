// Kliens- és szerveroldalon egyaránt használható cég-segédek (nincs szerver-import).

export type Company = { id: string; name: string; color: string | null };

export const COMPANY_COOKIE = "crm_company";

// Ha a cégnek nincs saját színe, a sorrendje alapján kap egyet
const FALLBACK_COLORS = ["#2e6ff2", "#d9a54e", "#16a34a", "#db2777", "#7c3aed", "#0891b2"];

export function companyColor(companies: Company[], id: string): string {
  const index = companies.findIndex((c) => c.id === id);
  return companies[index]?.color || FALLBACK_COLORS[Math.max(0, index) % FALLBACK_COLORS.length];
}

/** Csak a még létező cégek, a cégek sorrendjében. */
export function pickCompanies(companies: Company[], ids: (string | null | undefined)[] | null | undefined): Company[] {
  const set = new Set((ids ?? []).filter(Boolean));
  return companies.filter((c) => set.has(c.id));
}

/** Űrlap-olvasás (CompanyPicker): undefined, ha a mező nem szerepelt az űrlapon (ne írjuk felül). */
export function readCompanyIds(formData: FormData): string[] | undefined {
  if (!formData.get("company_ids_present")) return undefined;
  return formData.getAll("company_ids").map(String).filter(Boolean);
}

export function readCompanyId(formData: FormData): string | null | undefined {
  if (!formData.has("company_id")) return undefined;
  return String(formData.get("company_id") ?? "") || null;
}

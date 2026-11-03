import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_COOKIE, type Company } from "@/lib/company-shared";

/**
 * Az iroda cégei (pl. Bluegate, Interprop, Workerbase). Ha nincs egy sem —
 * vagy a 0042/0043-as migráció még nem futott —, üres lista: ilyenkor a
 * cég-mezők és -szűrők sehol nem jelennek meg.
 */
export const listCompanies = cache(async function listCompanies(): Promise<Company[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_companies")
    .select("id, name, color")
    .order("sort_order")
    .order("name");
  if (error) return [];
  return (data ?? []) as Company[];
});

/** Az oldalsávban kiválasztott cég (süti), ha még létezik; különben null = összes cég. */
export const getSelectedCompanyId = cache(async function getSelectedCompanyId(): Promise<string | null> {
  const value = (await cookies()).get(COMPANY_COOKIE)?.value;
  if (!value) return null;
  const companies = await listCompanies();
  return companies.some((c) => c.id === value) ? value : null;
});

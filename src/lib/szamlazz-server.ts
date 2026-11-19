// Csak szerveren (service-role kliens) — "use client" fájlból tilos importálni.
import { createAdminClient } from "@/lib/supabase/admin";
import { SZAMLAZZ_ENDPOINT } from "@/lib/szamlazz";

export type SzamlazzSettings = {
  company_id: string;
  key_hint: string | null;
  invoice_prefix: string | null;
  e_invoice: boolean;
};

type SettingsWithKey = SzamlazzSettings & { agent_key: string };

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703");
}

/**
 * Egy iroda cégeinek Számlázz.hu-beállításai (a kulcs NÉLKÜL — ez mehet a felületre).
 * `null`, ha a 0048-as migráció még nem futott le.
 */
export async function loadSzamlazzSettings(agencyId: string): Promise<Map<string, SzamlazzSettings> | null> {
  const { data, error } = await createAdminClient()
    .from("finance_company_szamlazz")
    .select("company_id, key_hint, invoice_prefix, e_invoice")
    .eq("agency_id", agencyId);
  if (isMissingTable(error)) return null;
  if (error) throw error;
  return new Map((data ?? []).map((s) => [s.company_id as string, s as SzamlazzSettings]));
}

/** A kulccsal együtt — csak szerveren, közvetlenül a Számlázz.hu-hívás előtt. */
export async function loadSzamlazzKey(agencyId: string, companyId: string): Promise<SettingsWithKey | null> {
  const { data, error } = await createAdminClient()
    .from("finance_company_szamlazz")
    .select("company_id, agent_key, key_hint, invoice_prefix, e_invoice")
    .eq("agency_id", agencyId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (isMissingTable(error)) return null;
  if (error) throw error;
  return (data as SettingsWithKey | null) ?? null;
}

export class SzamlazzNetworkError extends Error {}

/**
 * XML elküldése a Számla Agentnek (multipart, a megadott mezőnévvel).
 * Hálózati hiba / időtúllépés esetén `SzamlazzNetworkError` — ilyenkor NEM tudjuk,
 * elkészült-e a számla, ezért a hívó nem próbálhatja automatikusan újra.
 */
export async function postToSzamlazz(field: "action-xmlagentxmlfile" | "action-szamla_agent_xml", xml: string) {
  const form = new FormData();
  form.append(field, new Blob([xml], { type: "text/xml; charset=utf-8" }), "request.xml");
  let res: Response;
  try {
    res = await fetch(SZAMLAZZ_ENDPOINT, { method: "POST", body: form, signal: AbortSignal.timeout(45_000), cache: "no-store" });
  } catch (e) {
    throw new SzamlazzNetworkError(e instanceof Error ? e.message : String(e));
  }
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

// Csak szerveroldalon (server action-ökből) használható segédfüggvények.
import type { createClient } from "@/lib/supabase/server";
import type { PartnerKind } from "@/lib/finance";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Partner keresése név szerint (kis/nagybetű nem számít); ha nincs ilyen,
 * létrehozza — így a szállás- és számlaűrlapon elég beírni a nevet.
 * A szerepkört (bérbeadó / bérlő) bejelöli, ha még nincs.
 */
export async function resolvePartner(
  supabase: Supabase,
  agencyId: string,
  name: string | null,
  role: "landlord" | "tenant" | null,
): Promise<{ id: string; tax_number: string | null; kind: PartnerKind } | null> {
  if (!name) return null;
  const { data: found } = await supabase
    .from("finance_partners")
    .select("id, tax_number, kind, is_landlord, is_tenant")
    .ilike("name", name.replace(/[%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  if (found) {
    if (role === "landlord" && !found.is_landlord) await supabase.from("finance_partners").update({ is_landlord: true }).eq("id", found.id);
    if (role === "tenant" && !found.is_tenant) await supabase.from("finance_partners").update({ is_tenant: true }).eq("id", found.id);
    return { id: found.id, tax_number: found.tax_number, kind: found.kind };
  }
  if (!role) return null;
  const { data: created, error } = await supabase
    .from("finance_partners")
    .insert({
      agency_id: agencyId,
      name,
      // Bérlőnél jellemzően cég, bérbeadónál gyakran magánszemély — az adatlapon átállítható
      kind: role === "tenant" ? "company" : "person",
      is_landlord: role === "landlord",
      is_tenant: role === "tenant",
    })
    .select("id, tax_number, kind")
    .single();
  if (error) throw error;
  return created as { id: string; tax_number: string | null; kind: PartnerKind };
}


/**
 * Számla / törzs mentésekor: ha a partner neve szerepel a Partnerek között,
 * hozzákapcsolja és az adószámát onnan veszi; a kiválasztott szállás címe
 * lesz a helyszín. Új partnert itt nem hoz létre.
 */
export async function linkPartnerAndLodging(
  supabase: Supabase,
  counterpartyName: string,
  lodgingId: string | null,
  current: { counterparty_tax_number: string | null; location: string | null },
) {
  const partner = await resolvePartner(supabase, "", counterpartyName, null);
  let location = current.location;
  if (lodgingId) {
    const { data } = await supabase.from("finance_lodgings").select("address").eq("id", lodgingId).maybeSingle();
    if (data) location = data.address as string;
  }
  return {
    partner_id: partner?.id ?? null,
    counterparty_tax_number: partner?.tax_number ?? current.counterparty_tax_number,
    lodging_id: lodgingId,
    location,
  };
}

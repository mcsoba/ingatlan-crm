"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export type SearchResult = {
  id: string;
  type: "contact" | "property" | "deal";
  title: string;
  subtitle: string | null;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  await ensureCurrentUserProfile();

  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();

  const [{ data: contacts }, { data: properties }, { data: dealCandidates }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, email")
        .ilike("name", `%${q}%`)
        .limit(5),
      supabase
        .from("properties")
        .select("id, address, price")
        .ilike("address", `%${q}%`)
        .limit(5),
      supabase
        .from("deals")
        .select("id, contacts(name), properties(address)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const qLower = q.toLowerCase();
  const deals = ((dealCandidates ?? []) as unknown as {
    id: string;
    contacts: { name: string } | null;
    properties: { address: string } | null;
  }[])
    .filter(
      (d) =>
        d.contacts?.name.toLowerCase().includes(qLower) ||
        d.properties?.address.toLowerCase().includes(qLower),
    )
    .slice(0, 5);

  const results: SearchResult[] = [];

  for (const c of contacts ?? []) {
    results.push({
      id: c.id,
      type: "contact",
      title: c.name,
      subtitle: c.email,
      href: `/dashboard/contacts/${c.id}/edit`,
    });
  }

  for (const p of properties ?? []) {
    results.push({
      id: p.id,
      type: "property",
      title: p.address,
      subtitle: p.price ? `${p.price.toLocaleString("hu-HU")} Ft` : null,
      href: `/dashboard/properties/${p.id}/edit`,
    });
  }

  for (const d of deals) {
    results.push({
      id: d.id,
      type: "deal",
      title: d.contacts?.name ?? "Ismeretlen kontakt",
      subtitle: d.properties?.address ?? null,
      href: `/dashboard/pipeline/${d.id}`,
    });
  }

  return results;
}

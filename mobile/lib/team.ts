import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type TeamMember = { id: string; name: string };

let cache: TeamMember[] | null = null;

// Az iroda tagjai (a profiles RLS csak a saját irodát adja vissza) — a
// "Kinek a feladata?" és a "Felelős" választóhoz. Név nélküli tagnál
// "Kolléga" (a mobil nem látja mások e-mail címét).
export function useTeam(): TeamMember[] {
  const [team, setTeam] = useState<TeamMember[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("created_at")
      .then(({ data }) => {
        cache = (data ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string | null) || "Kolléga" }));
        setTeam(cache);
      });
  }, []);
  return team;
}

export function memberName(team: TeamMember[], id: string | null | undefined, meId?: string): string {
  if (!id) return "Nincs kijelölve";
  const name = team.find((m) => m.id === id)?.name ?? "Kolléga";
  return id === meId ? `${name} (én)` : name;
}

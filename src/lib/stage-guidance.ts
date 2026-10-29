// "Mit kell tenni ebben a szakaszban?" — rövid útmutató, ami az üzlet oldalán
// (web + mobil) látszik. Az iroda a Pipeline → Szakaszok oldalon átírhatja;
// ha üres, ezek az alapértelmezések látszanak a szokásos szakasznevekhez.
// A mobilapp megfelelője: mobile/lib/process.ts.

export const DEFAULT_STAGE_GUIDANCE: Record<string, string> = {
  lead: "Vedd fel a kapcsolatot 24 órán belül: hívd fel, tisztázd, mit keres (típus, környék, keret), és egyeztess megtekintést.",
  megtekintés:
    "Szervezd meg és tartsd meg a megtekintést. Utána még aznap kérj visszajelzést az ügyféltől, és rögzítsd jegyzetben.",
  ajánlat: "Rögzítsd írásban az ügyfél ajánlatát, add át az eladónak, és kövesd, amíg válasz nem érkezik.",
  alku: "Egyeztesd a feltételeket (ár, átadás időpontja, foglaló). Ha megvan a megállapodás, húzd az üzletet a Zárás oszlopba (ez a sikeres lezárás).",
  zárás: "Az üzlet sikeresen lezárult. Ami még hátra van (foglaló, ügyvéd, szerződés, kulcsátadás), azt az adásvételi ellenőrzőlistán pipálhatod ki.",
};

export function stageGuidance(stage: { name: string; guidance?: string | null } | null | undefined): string | null {
  if (!stage) return null;
  return stage.guidance?.trim() || DEFAULT_STAGE_GUIDANCE[stage.name.trim().toLowerCase()] || null;
}

// A munkafolyamat magyarázó szövegei: mit jelent egy állapot, és mit kell
// tenni az egyes pipeline-szakaszokban. A szakasz-útmutatót az iroda a webes
// CRM-ben (Pipeline → Szakaszok) átírhatja; ha nincs megadva, ezek az
// alapértelmezések látszanak (a webes src/lib/stage-guidance.ts megfelelője).

export const DEFAULT_STAGE_GUIDANCE: Record<string, string> = {
  lead: "Vedd fel a kapcsolatot 24 órán belül: hívd fel, tisztázd, mit keres (típus, környék, keret), és egyeztess megtekintést.",
  megtekintés: "Szervezd meg és tartsd meg a megtekintést. Utána még aznap kérj visszajelzést az ügyféltől, és rögzítsd jegyzetben.",
  ajánlat: "Rögzítsd írásban az ügyfél ajánlatát, add át az eladónak, és kövesd, amíg válasz nem érkezik.",
  alku: "Egyeztesd a feltételeket (ár, átadás időpontja, foglaló). Ha megvan a megállapodás, húzd az üzletet a Zárás oszlopba (ez a sikeres lezárás).",
  zárás: "Az üzlet sikeresen lezárult. Ami még hátra van (foglaló, ügyvéd, szerződés, kulcsátadás), azt az adásvételi ellenőrzőlistán pipálhatod ki.",
};

export function stageGuidance(stage: { name: string; guidance?: string | null } | null | undefined): string | null {
  if (!stage) return null;
  return stage.guidance?.trim() || DEFAULT_STAGE_GUIDANCE[stage.name.trim().toLowerCase()] || null;
}

export const CONTACT_STATUS_HELP: Record<string, string> = {
  new: "Még senki nem kereste. Hívd fel minél előbb!",
  contacted: "Már beszéltetek, de még nem derült ki, mennyire komoly.",
  qualified: "Komoly érdeklődő: tudod, mit keres, és van rá kerete. Érdemes üzletet nyitni neki.",
  inactive: "Egy ideje nem reagál, vagy már nem keres. Nem jelenik meg a teendők között.",
};

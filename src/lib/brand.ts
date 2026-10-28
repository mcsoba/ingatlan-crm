// A termék márkajelzése egy helyen. A generál (master) sablonban "Ingatlan CRM";
// egy irodára szabott branch (pl. bluegate) csak ezt a fájlt, a globals.css
// színeit, a public/ ikonokat és a manifest.json-t írja át.
export const BRAND = {
  name: "Ingatlan CRM",
  description: "AI-alapú CRM ingatlanos ügynököknek és irodáknak",
  themeColor: "#6366f1",
  // public/ alatti logó útvonala; null esetén az általános épület-ikon látszik
  logoSrc: null as string | null,
};

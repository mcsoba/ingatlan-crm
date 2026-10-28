// A termék márkajelzése egy helyen. A generál (master) sablonban "Ingatlan CRM";
// egy irodára szabott branch (pl. bluegate) csak ezt a fájlt, a globals.css
// színeit, a public/ ikonokat és a manifest.json-t írja át.
export const BRAND = {
  name: "Bluegate Housing",
  description: "A Bluegate Housing ügyfél- és ingatlankezelő rendszere",
  themeColor: "#12181D",
  // public/ alatti logó útvonala; null esetén az általános épület-ikon látszik
  logoSrc: "/brand/mark.png" as string | null,
};

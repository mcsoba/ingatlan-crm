import type { ImageSourcePropType } from "react-native";

// A mobilapp márkajelzése (a web src/lib/brand.ts párja). Irodára szabott
// branch ezt, a theme.ts accent-színét, az app.json nevét és az assets/ ikonjait írja át.
export const BRAND = {
  name: "Bluegate Housing",
  // null esetén az általános épület-ikon látszik a belépésnél
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  logo: require("../assets/brand/mark.png") as ImageSourcePropType | null,
};

import type { BadgeVariant } from "@/components/ui/badge";

export const SOURCE_LABELS: Record<string, string> = {
  website: "Weboldal",
  referral: "Ajánlás",
  phone: "Telefon",
  walk_in: "Betérő",
  other: "Egyéb",
};

export const STATUS_LABELS: Record<string, string> = {
  new: "Új",
  contacted: "Megkeresve",
  qualified: "Minősített",
  inactive: "Inaktív",
};

// Mit jelent az állapot, és mi a teendő vele (a mobilapp lib/process.ts megfelelője)
export const STATUS_HELP: Record<string, string> = {
  new: "Még senki nem kereste. Hívd fel minél előbb!",
  contacted: "Már beszéltetek, de még nem derült ki, mennyire komoly.",
  qualified: "Komoly érdeklődő: tudod, mit keres, és van rá kerete. Érdemes üzletet nyitni neki az Üzletek táblán.",
  inactive: "Egy ideje nem reagál, vagy már nem keres. Nem jelenik meg a teendők között.",
};

export const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  new: "neutral",
  contacted: "accent",
  qualified: "success",
  inactive: "neutral",
};

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
  contacted: "Felvéve",
  qualified: "Minősített",
  inactive: "Inaktív",
};

export const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  new: "neutral",
  contacted: "accent",
  qualified: "success",
  inactive: "neutral",
};

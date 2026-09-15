import type { BadgeVariant } from "@/components/ui/badge";

export const STATUS_LABELS: Record<string, string> = {
  available: "Elérhető",
  reserved: "Foglalt",
  sold: "Eladva",
  rented: "Kiadva",
};

export const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
  rented: "neutral",
};

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building } from "lucide-react";
import { COMPANY_COOKIE, type Company } from "@/lib/company-shared";

// Oldalsáv: melyik cég adatait mutassák a listák (üzletek, kontaktok,
// pénzügyek). Sütiben tároljuk, hogy oldalváltáskor és újratöltéskor megmaradjon.
export function CompanySwitcher({ companies, selectedId }: { companies: Company[]; selectedId: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  if (companies.length === 0) return null;

  return (
    <label className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-sidebar-foreground">
      <Building className="h-4 w-4 shrink-0 text-sidebar-muted" strokeWidth={1.75} />
      <select
        value={selectedId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          document.cookie = value
            ? `${COMPANY_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
            : `${COMPANY_COOKIE}=; path=/; max-age=0`;
          startTransition(() => router.refresh());
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none [&>option]:text-black"
        aria-label="Cég kiválasztása"
      >
        <option value="">Összes cég</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

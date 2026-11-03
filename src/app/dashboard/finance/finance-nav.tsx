"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { inputClass } from "@/components/ui/styles";

const TABS = [
  { href: "/dashboard/finance", label: "Áttekintés" },
  { href: "/dashboard/finance/invoices", label: "Számlák és tételek" },
  { href: "/dashboard/finance/schedules", label: "Számla-törzsek" },
  { href: "/dashboard/finance/companies", label: "Cégek" },
];

export function FinanceNav({ companies }: { companies: { id: string; name: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const company = params.get("company") ?? "";

  const withCompany = (href: string) => (company ? `${href}?company=${company}` : href);
  const isActive = (href: string) =>
    href === "/dashboard/finance" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={withCompany(t.href)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive(t.href) ? "bg-accent-soft font-medium text-accent-hover" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {companies.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Cég
          <select
            value={company}
            onChange={(e) => {
              const next = new URLSearchParams(params.toString());
              if (e.target.value) next.set("company", e.target.value);
              else next.delete("company");
              router.push(`${pathname}?${next.toString()}`);
            }}
            className={`${inputClass} py-1.5`}
          >
            <option value="">Összes cég</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

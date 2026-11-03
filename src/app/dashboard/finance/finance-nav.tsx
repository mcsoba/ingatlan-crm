"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A cég kiválasztása az oldalsáv globális cégválasztójával történik.
const TABS = [
  { href: "/dashboard/finance", label: "Áttekintés" },
  { href: "/dashboard/finance/expenses", label: "Kiadások" },
  { href: "/dashboard/finance/invoices", label: "Számlák és tételek" },
  { href: "/dashboard/finance/schedules", label: "Számla-törzsek" },
  { href: "/dashboard/finance/companies", label: "Cégek" },
];

export function FinanceNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard/finance" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            isActive(t.href) ? "bg-accent-soft font-medium text-accent-hover" : "text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

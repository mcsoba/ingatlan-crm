"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  UsersRound,
  BarChart3,
  CreditCard,
  Mail,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Áttekintés", icon: LayoutDashboard },
  { href: "/dashboard/contacts", label: "Kontaktok", icon: Users },
  { href: "/dashboard/properties", label: "Ingatlanok", icon: Building2 },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/dashboard/campaigns", label: "Kampányok", icon: Mail },
  { href: "/dashboard/reports", label: "Riportok", icon: BarChart3 },
  { href: "/dashboard/team", label: "Csapat", icon: UsersRound },
  { href: "/dashboard/billing", label: "Előfizetés", icon: CreditCard },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === href
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-active text-white"
                : "text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

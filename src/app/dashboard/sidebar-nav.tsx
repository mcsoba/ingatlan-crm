"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Building2,
  Kanban,
  UsersRound,
  BarChart3,
  CreditCard,
  Mail,
  Settings,
  CalendarDays,
  ListChecks,
  History,
  Tag,
  HelpCircle,
  Trash2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string | null; items: NavItem[] };

// Grouped rather than one flat 17-item list — a new user scanning the
// sidebar only needs to take in the 7-item "daily work" group at a glance;
// the rest is still one click away, just visually chunked out of the way.
const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Áttekintés", icon: LayoutDashboard },
      { href: "/dashboard/tasks", label: "Teendők", icon: ListChecks },
      { href: "/dashboard/leads", label: "Lead-postaláda", icon: Inbox },
      { href: "/dashboard/contacts", label: "Kontaktok", icon: Users },
      { href: "/dashboard/properties", label: "Ingatlanok", icon: Building2 },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban },
      { href: "/dashboard/calendar", label: "Naptár", icon: CalendarDays },
    ],
  },
  {
    label: "Elemzés és marketing",
    items: [
      { href: "/dashboard/reports", label: "Riportok", icon: BarChart3 },
      { href: "/dashboard/campaigns", label: "Kampányok", icon: Mail },
      { href: "/dashboard/tags", label: "Címkék", icon: Tag },
    ],
  },
  {
    label: "Fiók",
    items: [
      { href: "/dashboard/team", label: "Csapat", icon: UsersRound },
      { href: "/dashboard/billing", label: "Előfizetés", icon: CreditCard },
      { href: "/dashboard/settings", label: "Beállítások", icon: Settings },
      { href: "/dashboard/audit-log", label: "Előzmények", icon: History },
      { href: "/dashboard/trash", label: "Lomtár", icon: Trash2 },
      { href: "/dashboard/help", label: "Súgó", icon: HelpCircle },
      { href: "/dashboard/whats-new", label: "Újdonságok", icon: Sparkles },
    ],
  },
];

export function SidebarNav({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav className="flex flex-col gap-3">
      {NAV_GROUPS.map((group, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {group.label && (
            <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-sidebar-muted/70 uppercase">
              {group.label}
            </div>
          )}
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(href)
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {label}
              {badges[href] > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {badges[href] > 99 ? "99+" : badges[href]}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

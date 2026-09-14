import { Building2 } from "lucide-react";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";
import { SearchTrigger } from "./search-trigger";
import { CommandPalette } from "./command-palette";
import { NotificationsPanel } from "./notifications-panel";

const ROLE_LABELS: Record<string, string> = {
  owner: "Tulajdonos",
  agent: "Ügynök",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await ensureCurrentUserProfile();

  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <aside className="flex w-60 shrink-0 flex-col justify-between bg-sidebar px-3 py-4">
        <div>
          <div className="flex items-center gap-2 px-2 pt-1 pb-6">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-white">
              <Building2 className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <span className="truncate text-sm font-semibold text-sidebar-foreground">
              {profile.agencies.name}
            </span>
          </div>
          <SearchTrigger />
          <SidebarNav />
        </div>

        <div>
          <NotificationsPanel />
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </div>
              <div className="text-[11px] text-sidebar-muted">
                {profile.agencies.plan_tier === "pro" ? "Pro csomag" : "Ingyenes csomag"}
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex-1 bg-background">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </div>
    </div>
  );
}

import { BrandMark } from "@/components/brand-mark";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";
import { SearchTrigger } from "./search-trigger";
import { QuickCreate } from "./quick-create";
import { CommandPalette } from "./command-palette";
import { NotificationsPanel } from "./notifications-panel";
import { MobileNavShell } from "./mobile-nav-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { planLabel, SIMPLE_MODE } from "@/lib/edition";

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

  // Unprocessed-lead count for the sidebar badge (RLS scopes it to the
  // agency and hides soft-deleted contacts).
  const supabase = await createClient();
  const { count: newLeadCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  return (
    <ToastProvider>
      {!SIMPLE_MODE && <CommandPalette />}
      <MobileNavShell
        sidebar={
          <>
            <div>
              <div className="flex items-center gap-2 px-2 pt-1 pb-6">
                <BrandMark />
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {profile.agencies.name}
                </span>
              </div>
              <QuickCreate />
              {!SIMPLE_MODE && <SearchTrigger />}
              <SidebarNav badges={{ "/dashboard/leads": newLeadCount ?? 0 }} />
            </div>

            <div>
              <NotificationsPanel agencyId={profile.agency_id} />
              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-sidebar-foreground">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </div>
                  {planLabel(profile.agencies.plan_tier) && (
                    <div className="text-[11px] text-sidebar-muted">{planLabel(profile.agencies.plan_tier)}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <ThemeToggle />
                  <SignOutButton />
                </div>
              </div>
            </div>
          </>
        }
      >
        {children}
      </MobileNavShell>
    </ToastProvider>
  );
}

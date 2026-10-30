import Link from "next/link";
import { ChevronLeft, ChevronRight, Palmtree, Trash2 } from "lucide-react";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setLeaveAllowance, deleteLeave } from "./actions";
import { LeaveForm } from "./leave-form";
import { TasksViewSwitch } from "../tasks/view-switch";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

type Leave = {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  days: number;
  note: string | null;
};

function formatDays(n: number): string {
  return n.toLocaleString("hu-HU", { maximumFractionDigits: 1 });
}

function formatRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("hu-HU", { month: "short", day: "numeric", weekday: "short" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || new Date().getFullYear();
  const { profile } = await ensureCurrentUserProfile();
  const isManager = profile.role === "owner" || profile.role === "admin";
  const supabase = await createClient();

  const [membersRes, allowancesRes, leavesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").order("created_at"),
    supabase.from("leave_allowances").select("profile_id, days").eq("year", year),
    supabase
      .from("leaves")
      .select("id, profile_id, start_date, end_date, days, note")
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
      .order("start_date", { ascending: false }),
  ]);
  if (membersRes.error) throw membersRes.error;
  // A 0041_leave.sql lefuttatása előtt a táblák még nem léteznek — ilyenkor tájékoztatunk, nem dobunk hibát
  const notMigrated = Boolean(allowancesRes.error || leavesRes.error);

  const emailById = new Map<string, string>();
  if (isManager) {
    const { data: usersPage } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    for (const user of usersPage?.users ?? []) emailById.set(user.id, user.email ?? "");
  }
  const members = (membersRes.data ?? []).map((m) => ({
    id: m.id as string,
    name: (m.full_name as string | null) || emailById.get(m.id) || "Munkatárs",
  }));
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const allowanceById = new Map<string, number>();
  for (const a of allowancesRes.data ?? []) allowanceById.set(a.profile_id, Number(a.days));
  const leaves = (leavesRes.data ?? []) as Leave[];
  const usedById = new Map<string, number>();
  for (const l of leaves) usedById.set(l.profile_id, (usedById.get(l.profile_id) ?? 0) + Number(l.days));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Szabadságok"
        description="Éves szabadságkeret munkatársanként — a kivett napok automatikusan csökkentik a maradékot, és a naptárban is megjelennek."
        action={
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/leave?year=${year - 1}`}>
              <Button variant="secondary" size="sm">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <span className="text-sm font-medium tabular-nums">{year}</span>
            <Link href={`/dashboard/leave?year=${year + 1}`}>
              <Button variant="secondary" size="sm">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        }
      />

      <TasksViewSwitch active="leave" />

      {notMigrated ? (
        <Card className="p-4 text-sm text-muted">
          A szabadság-nyilvántartás adatbázis-frissítése (0041_leave.sql) még nem futott le — utána ez az oldal azonnal használható.
        </Card>
      ) : (
        <>
          <LeaveForm members={members} currentProfileId={profile.id} canPickMember={isManager} />

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Munkatárs</th>
                  <th className="px-4 py-2 font-medium">Éves keret ({year})</th>
                  <th className="px-4 py-2 text-right font-medium">Kivett</th>
                  <th className="px-4 py-2 text-right font-medium">Maradék</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const allowance = allowanceById.get(m.id);
                  const used = usedById.get(m.id) ?? 0;
                  const remaining = allowance !== undefined ? allowance - used : null;
                  return (
                    <tr key={m.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-2 font-medium text-foreground">
                        {m.name}
                        {m.id === profile.id && <span className="ml-1 text-xs text-muted">(te)</span>}
                      </td>
                      <td className="px-4 py-2">
                        {isManager ? (
                          <form action={setLeaveAllowance} className="flex items-center gap-1.5">
                            <input type="hidden" name="profile_id" value={m.id} />
                            <input type="hidden" name="year" value={year} />
                            <input
                              name="days"
                              inputMode="decimal"
                              defaultValue={allowance !== undefined ? formatDays(allowance) : ""}
                              placeholder="pl. 20"
                              className={`${inputClass} w-20 py-1`}
                            />
                            <span className="text-xs text-muted">nap</span>
                            <button type="submit" className="text-xs text-muted hover:text-accent">
                              Mentés
                            </button>
                          </form>
                        ) : allowance !== undefined ? (
                          `${formatDays(allowance)} nap`
                        ) : (
                          <span className="text-muted">nincs megadva</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatDays(used)} nap</td>
                      <td
                        className={`px-4 py-2 text-right font-semibold tabular-nums ${
                          remaining === null ? "text-muted" : remaining < 0 ? "text-danger" : "text-success"
                        }`}
                      >
                        {remaining === null ? "—" : `${formatDays(remaining)} nap`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Rögzített szabadságok ({year})</h2>
            {leaves.length === 0 ? (
              <p className="text-sm text-muted">Ebben az évben még nincs rögzített szabadság.</p>
            ) : (
              leaves.map((l) => (
                <Card key={l.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <Palmtree className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {nameById.get(l.profile_id) ?? "Munkatárs"} · {formatDays(Number(l.days))} nap
                    </div>
                    <div className="truncate text-xs text-muted">
                      {formatRange(l.start_date, l.end_date)}
                      {l.note && ` · ${l.note}`}
                    </div>
                  </div>
                  {(isManager || l.profile_id === profile.id) && (
                    <form action={deleteLeave}>
                      <input type="hidden" name="id" value={l.id} />
                      <button type="submit" title="Törlés" className="text-muted hover:text-danger">
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </form>
                  )}
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

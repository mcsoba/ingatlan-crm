import Link from "next/link";
import { ChevronLeft, ChevronRight, Palmtree, Trash2 } from "lucide-react";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setLeaveAllowance, deleteLeave } from "./actions";
import { LeaveForm } from "./leave-form";
import { countWorkdays } from "./workdays";
import { TasksViewSwitch } from "../tasks/view-switch";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { getSelectedCompanyId } from "@/lib/companies";

type Leave = {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  days: number;
  note: string | null;
};

const MONTHS_SHORT = ["jan", "feb", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];

function formatDays(n: number): string {
  return n.toLocaleString("hu-HU", { maximumFractionDigits: 1 });
}

function formatRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("hu-HU", { month: "short", day: "numeric", weekday: "short" });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function todayBudapest(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Egy szabadság napjai hónapokra bontva (több hónapon átívelőnél a munkanapok arányában). */
function daysByMonth(l: Leave, year: number): number[] {
  const out = new Array(12).fill(0) as number[];
  const total = Number(l.days);
  const startMonth = l.start_date.slice(0, 7);
  if (startMonth === l.end_date.slice(0, 7)) {
    if (Number(l.start_date.slice(0, 4)) === year) out[Number(l.start_date.slice(5, 7)) - 1] += total;
    return out;
  }
  const allWorkdays = countWorkdays(l.start_date, l.end_date) || 1;
  let cursor = l.start_date;
  while (cursor <= l.end_date) {
    const [y, m] = cursor.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const segEnd = monthEnd < l.end_date ? monthEnd : l.end_date;
    if (y === year) out[m - 1] += (total * countWorkdays(cursor, segEnd)) / allWorkdays;
    cursor = addDaysIso(monthEnd, 1);
  }
  return out;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || new Date().getFullYear();
  const today = todayBudapest();
  const { profile } = await ensureCurrentUserProfile();
  const isManager = profile.role === "owner" || profile.role === "admin";
  const supabase = await createClient();

  const [membersRes, allowancesRes, leavesRes, selectedCompanyId] = await Promise.all([
    supabase.from("profiles").select("id, full_name, company_ids").order("created_at"),
    supabase.from("leave_allowances").select("profile_id, days").eq("year", year),
    supabase
      .from("leaves")
      .select("id, profile_id, start_date, end_date, days, note")
      .gte("end_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
      .order("start_date", { ascending: true }),
    getSelectedCompanyId(),
  ]);
  if (membersRes.error) throw membersRes.error;
  // A 0041_leave.sql lefuttatása előtt a táblák még nem léteznek — ilyenkor tájékoztatunk, nem dobunk hibát
  const notMigrated = Boolean(allowancesRes.error || leavesRes.error);

  const emailById = new Map<string, string>();
  if (isManager) {
    const { data: usersPage } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    for (const user of usersPage?.users ?? []) emailById.set(user.id, user.email ?? "");
  }
  // Oldalsávban kiválasztott cég: csak az ő munkatársai (és a saját sorod)
  const companyMembers = (membersRes.data ?? []).filter(
    (m) => !selectedCompanyId || m.id === profile.id || ((m.company_ids as string[] | null) ?? []).includes(selectedCompanyId),
  );
  const members = companyMembers.map((m) => ({
    id: m.id as string,
    name: (m.full_name as string | null) || emailById.get(m.id) || "Munkatárs",
  }));
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const allowanceById = new Map<string, number>();
  for (const a of allowancesRes.data ?? []) allowanceById.set(a.profile_id, Number(a.days));
  const memberIds = new Set(members.map((m) => m.id));
  const leaves = ((leavesRes.data ?? []) as Leave[]).filter((l) => memberIds.has(l.profile_id));

  // Személyenként: havi bontás, kivett (már elmúlt) és tervezett (jövőbeli) napok
  const perPerson = members.map((m) => {
    const own = leaves.filter((l) => l.profile_id === m.id);
    const months = new Array(12).fill(0) as number[];
    let taken = 0;
    let planned = 0;
    for (const l of own) {
      const split = daysByMonth(l, year);
      const inYear = split.reduce((s, d) => s + d, 0);
      split.forEach((d, i) => (months[i] += d));
      if (l.start_date > today) planned += inYear;
      else taken += inYear;
    }
    const allowance = allowanceById.get(m.id);
    const used = taken + planned;
    return { ...m, own, months, taken, planned, used, allowance, remaining: allowance !== undefined ? allowance - used : null };
  });

  // Most és a következő 30 napban szabadságon
  const horizon = addDaysIso(today, 30);
  const current = leaves.filter((l) => l.start_date <= today && l.end_date >= today);
  const upcoming = leaves.filter((l) => l.start_date > today && l.start_date <= horizon);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Szabadságok"
        description="Éves szabadságkeret munkatársanként — a rögzített napok automatikusan csökkentik a maradékot, és a naptárban is megjelennek."
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
          {(current.length > 0 || upcoming.length > 0) && (
            <Card className="flex flex-col gap-2 border-success/30 p-4 text-sm">
              {current.length > 0 && (
                <div>
                  <span className="font-semibold text-success">Ma szabadságon: </span>
                  {current.map((l) => `${nameById.get(l.profile_id)} (${formatRange(l.start_date, l.end_date)})`).join(", ")}
                </div>
              )}
              {upcoming.length > 0 && (
                <div>
                  <span className="font-semibold text-foreground">A következő 30 napban: </span>
                  {upcoming.map((l) => `${nameById.get(l.profile_id)} (${formatRange(l.start_date, l.end_date)})`).join(", ")}
                </div>
              )}
            </Card>
          )}

          <LeaveForm members={members} currentProfileId={profile.id} canPickMember={isManager} />

          {/* ---------- munkatársanként ---------- */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {perPerson.map((p) => {
              const pct = p.allowance ? Math.min(100, (p.used / p.allowance) * 100) : 0;
              const takenPct = p.allowance ? Math.min(100, (p.taken / p.allowance) * 100) : 0;
              return (
                <Card key={p.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-foreground">
                      {p.name}
                      {p.id === profile.id && <span className="ml-1 text-xs font-normal text-muted">(te)</span>}
                    </div>
                    <div
                      className={`text-right text-lg font-semibold tabular-nums ${
                        p.remaining === null ? "text-muted" : p.remaining < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {p.remaining === null ? "—" : `${formatDays(p.remaining)} nap`}
                      <div className="text-xs font-normal text-muted">maradék</div>
                    </div>
                  </div>

                  {p.allowance ? (
                    <div className="h-2 overflow-hidden rounded-full bg-background" title="Sötét: már kivett · világos: tervezett">
                      <div className="flex h-full">
                        <div className="h-full bg-accent" style={{ width: `${takenPct}%` }} />
                        <div className="h-full bg-accent/40" style={{ width: `${pct - takenPct}%` }} />
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-background px-2 py-1.5">
                      <div className="text-muted">Keret</div>
                      {isManager ? (
                        <form action={setLeaveAllowance} className="mt-0.5 flex items-center justify-center gap-1">
                          <input type="hidden" name="profile_id" value={p.id} />
                          <input type="hidden" name="year" value={year} />
                          <input
                            name="days"
                            inputMode="decimal"
                            defaultValue={p.allowance !== undefined ? formatDays(p.allowance) : ""}
                            placeholder="pl. 20"
                            className={`${inputClass} w-14 px-1 py-0.5 text-center text-sm`}
                          />
                          <button type="submit" className="text-accent hover:underline">
                            ✓
                          </button>
                        </form>
                      ) : (
                        <div className="text-sm font-semibold text-foreground">{p.allowance !== undefined ? formatDays(p.allowance) : "—"}</div>
                      )}
                    </div>
                    <div className="rounded-lg bg-background px-2 py-1.5">
                      <div className="text-muted">Kivett</div>
                      <div className="text-sm font-semibold text-foreground">{formatDays(p.taken)}</div>
                    </div>
                    <div className="rounded-lg bg-background px-2 py-1.5">
                      <div className="text-muted">Tervezett</div>
                      <div className="text-sm font-semibold text-foreground">{formatDays(p.planned)}</div>
                    </div>
                  </div>

                  {p.own.length === 0 ? (
                    <p className="text-xs text-muted">Ebben az évben még nincs rögzített szabadsága.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border-subtle text-sm">
                      {p.own.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 py-1.5">
                          <Palmtree className={`h-3.5 w-3.5 shrink-0 ${l.start_date > today ? "text-muted" : "text-success"}`} strokeWidth={1.75} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate">
                              {formatRange(l.start_date, l.end_date)} · <b>{formatDays(Number(l.days))} nap</b>
                            </div>
                            {l.note && <div className="truncate text-xs text-muted">{l.note}</div>}
                          </div>
                          {l.start_date > today && <span className="text-[11px] text-muted">tervezett</span>}
                          {(isManager || l.profile_id === profile.id) && (
                            <form action={deleteLeave}>
                              <input type="hidden" name="id" value={l.id} />
                              <button type="submit" title="Törlés" className="text-muted hover:text-danger">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>

          {/* ---------- éves áttekintő ---------- */}
          <Card className="overflow-x-auto p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">{year}. évi áttekintő — szabadságnapok havonta</div>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-2 text-left font-medium">Munkatárs</th>
                  {MONTHS_SHORT.map((mn) => (
                    <th key={mn} className="px-1 py-2 text-center font-medium">
                      {mn}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium">Össz.</th>
                </tr>
              </thead>
              <tbody>
                {perPerson.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-1.5 font-medium">{p.name}</td>
                    {p.months.map((d, i) => (
                      <td key={i} className="px-1 py-1.5 text-center tabular-nums">
                        {d > 0 ? (
                          <span className="inline-block min-w-7 rounded bg-success-soft px-1 text-success">{formatDays(Math.round(d * 2) / 2)}</span>
                        ) : (
                          <span className="text-muted-subtle">·</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{formatDays(p.used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { listTeamMembers } from "@/lib/team";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { TasksList, type TaskRow } from "./tasks-list";
import { TaskQuickAdd } from "./task-quick-add";
import { TasksViewSwitch } from "./view-switch";
import { SIMPLE_MODE } from "@/lib/edition";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; who?: string }>;
}) {
  const { status = "open", type, who: whoParam = "me" } = await searchParams;
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();
  const members = await listTeamMembers();
  // "me" = a sajátjaim, "all" = az egész iroda, különben egy munkatárs azonosítója
  const who = whoParam === "all" || whoParam === "me" || members.some((m) => m.id === whoParam) ? whoParam : "me";
  const whoId = who === "me" ? profile.id : who === "all" ? null : who;

  let query = supabase
    .from("activities")
    .select("id, type, content, due_at, done, recurrence, assigned_to, contacts(id, name), deals(id)")
    .neq("type", "checklist")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (status === "open") query = query.eq("done", false);
  else if (status === "done") query = query.eq("done", true);
  if (type) query = query.eq("type", type);
  if (whoId) query = query.eq("assigned_to", whoId);

  // Ki mennyi nyitott (és lejárt) teendővel áll — a fejléc-csempékhez
  const [{ data: activities, error }, { data: openAll }] = await Promise.all([
    query,
    supabase.from("activities").select("assigned_to, due_at").eq("done", false).neq("type", "checklist"),
  ]);
  if (error) throw error;

  const now = new Date().getTime();
  const load = new Map<string, { open: number; overdue: number }>();
  for (const a of openAll ?? []) {
    const key = (a.assigned_to as string | null) ?? "none";
    const entry = load.get(key) ?? { open: 0, overdue: 0 };
    entry.open += 1;
    if (a.due_at && new Date(a.due_at).getTime() < now) entry.overdue += 1;
    load.set(key, entry);
  }
  const unassigned = load.get("none");

  const hasFilters = status !== "open" || Boolean(type) || who !== "me";
  const whoHref = (value: string) => {
    const params = new URLSearchParams({ who: value });
    if (status !== "open") params.set("status", status);
    if (type) params.set("type", type);
    return `/dashboard/tasks?${params}`;
  };
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "Munkatárs";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teendők"
        description="Hívások, megtekintések és emlékeztetők határidő szerint, felelősökhöz rendelve. Alapból a saját feladataidat látod."
        helpText="Fent látod, kinek hány nyitott (és lejárt) teendője van — kattints egy névre a szűréshez. Új teendőnél a „Kinek?” mezőben adhatod meg a felelőst, a listában pedig bármelyik teendő átadható egy kollégának (ő értesítést kap)."
      />

      <TasksViewSwitch active="list" />

      {members.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={whoHref("all")}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              who === "all" ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:border-accent/50"
            }`}
          >
            <div className="font-medium">Az egész iroda</div>
            <div className="text-xs text-muted">{(openAll ?? []).length} nyitott</div>
          </Link>
          {members.map((m) => {
            const l = load.get(m.id) ?? { open: 0, overdue: 0 };
            const active = whoId === m.id;
            return (
              <Link
                key={m.id}
                href={whoHref(m.id === profile.id ? "me" : m.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:border-accent/50"
                }`}
              >
                <div className="font-medium">{m.id === profile.id ? `${m.name} (én)` : m.name}</div>
                <div className="text-xs text-muted">
                  {l.open} nyitott
                  {l.overdue > 0 && <span className="text-danger"> · {l.overdue} lejárt</span>}
                </div>
              </Link>
            );
          })}
          {unassigned && (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted">
              <div className="font-medium">Nincs felelőse</div>
              <div className="text-xs">{unassigned.open} nyitott</div>
            </div>
          )}
        </div>
      )}

      <TaskQuickAdd members={members} currentUserId={profile.id} defaultAssignee={whoId ?? profile.id} />

      <form className="flex flex-wrap gap-2">
        <select name="who" defaultValue={who} className={inputClass}>
          <option value="me">Az enyéim</option>
          <option value="all">Az egész iroda</option>
          {members
            .filter((m) => m.id !== profile.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <select name="status" defaultValue={status} className={inputClass}>
          <option value="open">Nyitott</option>
          <option value="done">Kész</option>
          <option value="all">Összes</option>
        </select>
        <select name="type" defaultValue={type ?? ""} className={inputClass}>
          <option value="">Minden típus</option>
          {!SIMPLE_MODE && <option value="note">Jegyzet</option>}
          <option value="call">Hívás</option>
          <option value="viewing">Megtekintés</option>
          <option value="reminder">Emlékeztető</option>
        </select>
        <button type="submit" className={buttonVariants("secondary")}>
          Szűrés
        </button>
        {hasFilters && (
          <Link href="/dashboard/tasks" className={buttonVariants("ghost")}>
            Törlés
          </Link>
        )}
      </form>

      {whoId && whoId !== profile.id && <p className="-mt-3 text-sm text-muted">{memberName(whoId)} teendői</p>}

      {activities.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={hasFilters ? "Nincs a szűrésnek megfelelő teendő" : "Nincs nyitott teendő"}
          description={
            hasFilters
              ? "Próbálj más szűrőt."
              : "Amint felviszel egy hívást, megtekintést vagy emlékeztetőt, itt fog megjelenni."
          }
        />
      ) : (
        <TasksList activities={activities as unknown as TaskRow[]} members={members} currentUserId={profile.id} />
      )}
    </div>
  );
}

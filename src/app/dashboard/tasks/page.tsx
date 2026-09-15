import Link from "next/link";
import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { TasksList, type TaskRow } from "./tasks-list";
import { TaskQuickAdd } from "./task-quick-add";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const { status = "open", type } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("activities")
    .select("id, type, content, due_at, done, contacts(id, name), deals(id)")
    .neq("type", "checklist")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (status === "open") query = query.eq("done", false);
  else if (status === "done") query = query.eq("done", true);
  if (type) query = query.eq("type", type);

  const { data: activities, error } = await query;
  if (error) throw error;

  const hasFilters = status !== "open" || Boolean(type);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teendők"
        description="Az iroda összes hívása, megtekintése és emlékeztetője egy listában."
        helpText="Minden csapattag teendője itt látszik, nem csak a sajátod — a naptár havi nézete helyett ez a teljes, szűrhető lista."
      />

      <TaskQuickAdd />

      <form className="flex flex-wrap gap-2">
        <select name="status" defaultValue={status} className={inputClass}>
          <option value="open">Nyitott</option>
          <option value="done">Kész</option>
          <option value="all">Összes</option>
        </select>
        <select name="type" defaultValue={type ?? ""} className={inputClass}>
          <option value="">Minden típus</option>
          <option value="note">Jegyzet</option>
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
        <TasksList activities={activities as unknown as TaskRow[]} />
      )}
    </div>
  );
}

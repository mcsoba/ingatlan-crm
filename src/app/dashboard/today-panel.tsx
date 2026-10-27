import Link from "next/link";
import { AlertTriangle, CalendarCheck, Circle, Phone, PhoneCall } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { budapestEndOfToday, TZ } from "@/lib/time";
import { toggleActivityDone } from "./activities/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

type TaskRow = {
  id: string;
  type: string;
  content: string;
  due_at: string;
  contacts: { id: string; name: string } | null;
  deals: { id: string } | null;
};
type DealRow = { id: string; contact_id: string; contacts: { name: string } | null; pipeline_stages: { name: string } | null };

function waitingFor(iso: string): string {
  const days = Math.floor((new Date().getTime() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "ma érkezett" : days === 1 ? "tegnap érkezett" : `${days} napja vár`;
}

// "Mai teendőid": a bejelentkezett felhasználó napi munkája három oszlopban —
// mit kell ma elvégezni, kit kell felhívni, melyik üzlet akadt el.
export async function TodayPanel({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const now = new Date();
  const endOfToday = budapestEndOfToday(now);

  const [{ data: taskData }, { data: leadData }, { data: dealData }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, type, content, due_at, contacts(id, name), deals(id)")
      .eq("done", false)
      .eq("assigned_to", profileId)
      .neq("type", "checklist")
      .not("due_at", "is", null)
      .lte("due_at", endOfToday.toISOString())
      .order("due_at", { ascending: true })
      .limit(8),
    supabase
      .from("contacts")
      .select("id, name, phone, created_at")
      .eq("status", "new")
      .or(`owner_id.eq.${profileId},owner_id.is.null`)
      .order("created_at", { ascending: true })
      .limit(6),
    supabase
      .from("deals")
      .select("id, contact_id, contacts(name), pipeline_stages(name)")
      .eq("status", "open")
      .eq("owner_id", profileId)
      .limit(200),
  ]);

  const tasks = (taskData ?? []) as unknown as TaskRow[];
  const leads = leadData ?? [];
  const deals = (dealData ?? []) as unknown as DealRow[];

  let stuck: DealRow[] = [];
  if (deals.length) {
    const { data: open } = await supabase
      .from("activities")
      .select("deal_id, contact_id")
      .eq("done", false)
      .not("due_at", "is", null)
      .or(`deal_id.in.(${deals.map((d) => d.id).join(",")}),contact_id.in.(${deals.map((d) => d.contact_id).join(",")})`);
    const covered = new Set<string>();
    for (const a of open ?? []) {
      if (a.deal_id) covered.add(a.deal_id);
      if (a.contact_id) covered.add(`c:${a.contact_id}`);
    }
    stuck = deals.filter((d) => !covered.has(d.id) && !covered.has(`c:${d.contact_id}`)).slice(0, 6);
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Mai teendőid</h2>
        <p className="text-xs text-muted">
          Haladj balról jobbra: végezd el a mai feladatokat, hívd fel az új érdeklődőket, és adj következő lépést az elakadt üzleteknek.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3 p-4">
          <ColumnHeader
            icon={<CalendarCheck className="h-4 w-4 text-accent" />}
            title="1. Mai és lejárt feladatok"
            count={tasks.length}
            href="/dashboard/tasks"
            linkLabel="Összes teendő"
          />
          {tasks.length === 0 ? (
            <Empty text="Mára nincs több feladatod." />
          ) : (
            tasks.map((t) => {
              const overdue = new Date(t.due_at).getTime() < now.getTime();
              const href = t.deals
                ? `/dashboard/pipeline/${t.deals.id}`
                : t.contacts
                  ? `/dashboard/contacts/${t.contacts.id}/edit?tab=kapcsolodo`
                  : "/dashboard/tasks";
              return (
                <div key={t.id} className="flex items-start gap-2">
                  <form action={toggleActivityDone.bind(null, t.id, true, "/dashboard")}>
                    <button
                      type="submit"
                      title="Késznek jelölés"
                      className="mt-0.5 text-muted-subtle hover:text-success"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                  </form>
                  <Link href={href} className="min-w-0 flex-1 text-sm hover:text-accent">
                    <div className="truncate text-foreground">{t.content}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge variant="neutral">{TYPE_LABELS[t.type] ?? t.type}</Badge>
                      <span className={overdue ? "font-medium text-danger" : ""}>
                        {overdue ? "Lejárt · " : ""}
                        {new Date(t.due_at).toLocaleString("hu-HU", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {t.contacts && <span>· {t.contacts.name}</span>}
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <ColumnHeader
            icon={<PhoneCall className="h-4 w-4 text-warning" />}
            title="2. Hívd fel őket"
            count={leads.length}
            href="/dashboard/leads"
            linkLabel="Új érdeklődők"
          />
          <p className="-mt-2 text-xs text-muted">
            Új érdeklődők, akiket még senki nem keresett. Hívás után állítsd az állapotukat „Megkeresve”-re.
          </p>
          {leads.length === 0 ? (
            <Empty text="Minden új érdeklődő fel van hívva." />
          ) : (
            leads.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm">
                <Link href={`/dashboard/contacts/${l.id}/edit`} className="min-w-0 flex-1 hover:text-accent">
                  <div className="truncate font-medium text-foreground">{l.name}</div>
                  <div className="text-xs text-muted">{waitingFor(l.created_at)}</div>
                </Link>
                {l.phone && (
                  <a
                    href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-xs font-medium text-success"
                  >
                    <Phone className="h-3 w-3" />
                    {l.phone}
                  </a>
                )}
              </div>
            ))
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <ColumnHeader
            icon={<AlertTriangle className="h-4 w-4 text-danger" />}
            title="3. Elakadt üzleteid"
            count={stuck.length}
            href="/dashboard/pipeline"
            linkLabel="Üzletek"
          />
          <p className="-mt-2 text-xs text-muted">
            Nyitott üzletek ütemezett következő lépés nélkül. Nyisd meg, és adj hozzá egy teendőt határidővel.
          </p>
          {stuck.length === 0 ? (
            <Empty text="Minden üzletednek van következő lépése." />
          ) : (
            stuck.map((d) => (
              <Link
                key={d.id}
                href={`/dashboard/pipeline/${d.id}#uj-teendo`}
                className="flex items-center justify-between gap-2 text-sm hover:text-accent"
              >
                <span className="truncate font-medium text-foreground">{d.contacts?.name ?? "Üzlet"}</span>
                <Badge variant="neutral">{d.pipeline_stages?.name ?? "—"}</Badge>
              </Link>
            ))
          )}
        </Card>
      </div>
    </section>
  );
}

function ColumnHeader({
  icon,
  title,
  count,
  href,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {title}
        {count > 0 && <span className="rounded-full bg-background px-1.5 text-xs text-muted">{count}</span>}
      </div>
      <Link href={href} className="shrink-0 text-xs text-muted hover:text-accent">
        {linkLabel} →
      </Link>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md bg-success-soft/50 px-3 py-2 text-xs text-success">✓ {text}</div>;
}

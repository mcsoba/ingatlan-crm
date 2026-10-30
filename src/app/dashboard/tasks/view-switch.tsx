import Link from "next/link";
import { ListChecks, CalendarDays, Palmtree } from "lucide-react";

// Lista / Naptár / Szabadságok váltó a Teendők, a Naptár és a Szabadságok oldal
// tetején (egyszerű módban a Naptár nincs külön a menüben).
export function TasksViewSwitch({ active }: { active: "list" | "calendar" | "leave" }) {
  const item = (isActive: boolean) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
    }`;
  return (
    <div className="flex self-start rounded-lg bg-background p-1">
      <Link href="/dashboard/tasks" className={item(active === "list")}>
        <ListChecks className="h-4 w-4" strokeWidth={1.75} />
        Lista
      </Link>
      <Link href="/dashboard/calendar" className={item(active === "calendar")}>
        <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
        Naptár
      </Link>
      <Link href="/dashboard/leave" className={item(active === "leave")}>
        <Palmtree className="h-4 w-4" strokeWidth={1.75} />
        Szabadságok
      </Link>
    </div>
  );
}

import Link from "next/link";
import { ListChecks, CalendarDays } from "lucide-react";

// Lista / Naptár váltó a Teendők és a Naptár oldal tetején — ugyanaz az adat,
// két nézetben (egyszerű módban a Naptár nincs külön a menüben).
export function TasksViewSwitch({ active }: { active: "list" | "calendar" }) {
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
    </div>
  );
}

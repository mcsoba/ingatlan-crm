import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { occurrences, type TaxObligation, type TaxTask } from "@/lib/finance-tax";
import { addDays, formatDate, todayIso } from "@/lib/finance";

/** Sáv a Pénzügyek tetején: lejárt vagy 7 napon belül esedékes adó (minden cégnél). A 0052 előtt nem jelenik meg. */
export async function TaxAlert() {
  const supabase = await createClient();
  const today = todayIso();
  const { data: obRows, error } = await supabase
    .from("finance_tax_obligations")
    .select("id, company_id, name, schedule, municipality, amount, notes, active, sort_order, created_at")
    .eq("active", true);
  if (error || !obRows?.length) return null;
  const { data: taskRows } = await supabase.from("finance_tax_tasks").select("id, obligation_id, due_date, done_at, amount, note").gte("due_date", addDays(today, -400));
  const open = occurrences(obRows as TaxObligation[], (taskRows ?? []) as TaxTask[], addDays(today, -365), addDays(today, 7)).filter((o) => !o.task?.done_at);
  if (!open.length) return null;
  const overdue = open.filter((o) => o.due < today);
  const { data: companies } = await supabase.from("finance_companies").select("id, name");
  const nameOf = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  const first = open[0];
  return (
    <Link
      href={`/dashboard/finance/taxes?company=${first.obligation.company_id}`}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${overdue.length ? "border-danger/40 bg-danger-soft text-danger" : "border-warning/40 bg-warning-soft text-warning"}`}
    >
      <CalendarClock className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {overdue.length ? <strong>{overdue.length} lejárt adóhatáridő</strong> : <strong>Adóhatáridő 7 napon belül</strong>}
        {" — "}
        {first.obligation.name}
        {nameOf.size > 1 ? ` (${nameOf.get(first.obligation.company_id) ?? ""})` : ""}: {formatDate(first.due)}
        {open.length > 1 ? ` · és még ${open.length - 1}` : ""}
      </span>
      <span className="text-xs underline">Adónaptár</span>
    </Link>
  );
}

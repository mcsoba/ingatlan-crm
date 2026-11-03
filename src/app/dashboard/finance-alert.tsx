import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/finance";

// Kezdőlapi figyelmeztetés irodavezetőknek: ma esedékes / késésben lévő
// kiállítandó számlák és lejárt fizetési határidők. A pénzügyi modul nélküli
// telepítésben (nincs 0042-es migráció) csendben nem jelenik meg.
export async function FinanceAlert() {
  const supabase = await createClient();
  const today = todayIso();
  const [{ count: toInvoice, error }, { count: overdue }] = await Promise.all([
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("is_planned", true)
      .eq("direction", "out")
      .lte("issue_date", today),
    supabase
      .from("finance_invoices")
      .select("id", { count: "exact", head: true })
      .eq("is_planned", false)
      .is("paid_date", null)
      .lt("due_date", today),
  ]);
  if (error || (!toInvoice && !overdue)) return null;

  const parts: string[] = [];
  if (toInvoice) parts.push(`${toInvoice} számlát kell kiállítani`);
  if (overdue) parts.push(`${overdue} számla fizetési határideje lejárt`);

  return (
    <Link
      href="/dashboard/finance"
      className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm transition-colors hover:border-warning"
    >
      <FilePlus2 className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
      <span className="flex-1 font-medium text-foreground">Pénzügyek: {parts.join(", ")}.</span>
      <span className="text-xs text-muted">Megnyitás →</span>
    </Link>
  );
}

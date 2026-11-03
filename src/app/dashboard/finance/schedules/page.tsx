import Link from "next/link";
import { Plus, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { generateDueInvoices } from "@/lib/finance-server";
import { toggleSchedule } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FREQUENCY_LABELS,
  SCHEDULE_SELECT,
  computeGross,
  formatDate,
  formatMoney,
  occurrenceFrom,
  type ScheduleRow,
} from "@/lib/finance";

export default async function FinanceSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const supabase = await createClient();
  await generateDueInvoices(supabase);
  let query = supabase.from("finance_schedules").select(SCHEDULE_SELECT);
  if (company) query = query.eq("company_id", company);
  const [{ data }, { data: companies }] = await Promise.all([
    query.order("direction", { ascending: false }).order("counterparty_name"),
    supabase.from("finance_companies").select("id, name"),
  ]);
  const schedules = (data ?? []) as ScheduleRow[];
  const companyName = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));

  const groups: { title: string; rows: ScheduleRow[] }[] = [
    { title: "Kimenő — mi számlázunk", rows: schedules.filter((s) => s.direction === "out") },
    { title: "Bejövő — mi fizetünk", rows: schedules.filter((s) => s.direction === "in") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Számla-törzsek"
        description="Ismétlődő számlák (pl. havi bérleti díj, bérbeadóknak fizetett díj). A rendszer a kiállítás előtt magától létrehozza a tételt a „Számlázandó” listán, és reggel értesít. Az összeg és az időzítés bármikor módosítható."
        action={
          <Link href={`/dashboard/finance/schedules/new${company ? `?company=${company}` : ""}`} className={buttonVariants("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" />
            Új törzs
          </Link>
        }
      />

      {schedules.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="Még nincs számla-törzs"
          description="Egy törzs = egy ismétlődő számla (pl. egy bérlő havi bérleti díja). Hozd létre egyszer, utána minden hónapban magától előkészül."
        />
      )}

      {groups
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {g.title} <span className="font-normal text-muted">({g.rows.length})</span>
            </h2>
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Partner</th>
                    <th className="px-2 py-2 font-medium">Tartalom / helyszín</th>
                    <th className="px-2 py-2 font-medium">Cég</th>
                    <th className="px-2 py-2 font-medium">Gyakoriság</th>
                    <th className="px-2 py-2 font-medium">Következő kiállítás</th>
                    <th className="px-2 py-2 text-right font-medium">Bruttó</th>
                    <th className="px-4 py-2 text-right font-medium">Állapot</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((s) => {
                    const next = s.active ? occurrenceFrom(s, s.next_period_start) : null;
                    const { gross } = computeGross(Number(s.net_amount), s.vat_rate === null ? null : Number(s.vat_rate), s.currency);
                    return (
                      <tr key={s.id} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                        <td className="px-4 py-2">
                          <Link href={`/dashboard/finance/schedules/${s.id}`} className="font-medium text-foreground hover:underline">
                            {s.counterparty_name}
                          </Link>
                        </td>
                        <td className="max-w-[280px] px-2 py-2">
                          <div>{s.description}</div>
                          {s.location && <div className="text-xs text-muted">{s.location}</div>}
                        </td>
                        <td className="px-2 py-2 text-xs">{companyName.get(s.company_id)}</td>
                        <td className="px-2 py-2 text-xs">
                          {FREQUENCY_LABELS[s.frequency]}
                          {s.frequency !== "once" && <div className="text-muted">kiállítás: {s.issue_day}. napon</div>}
                          {s.end_date && <div className="text-muted">vége: {formatDate(s.end_date)}</div>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {next ? formatDate(next.issueDate) : <span className="text-muted">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatMoney(gross, s.currency)}</td>
                        <td className="px-4 py-2 text-right">
                          <form action={toggleSchedule} className="inline-flex items-center gap-2">
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="active" value={s.active ? "0" : "1"} />
                            <Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Aktív" : "Szünetel"}</Badge>
                            <button type="submit" className="text-xs text-muted hover:text-accent">
                              {s.active ? "Szüneteltetés" : "Újraindítás"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        ))}
    </div>
  );
}

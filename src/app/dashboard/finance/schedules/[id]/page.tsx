import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteSchedule } from "../../actions";
import { loadFormOptions } from "../../data";
import { ScheduleForm } from "../../schedule-form";
import { ConfirmDelete } from "../../confirm-delete";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  INVOICE_SELECT,
  SCHEDULE_SELECT,
  STATUS_VARIANT,
  formatMoney,
  formatPeriod,
  invoiceStatus,
  statusLabel,
  todayIso,
  type InvoiceRow,
  type ScheduleRow,
} from "@/lib/finance";

export default async function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: invoiceData }, options] = await Promise.all([
    supabase.from("finance_schedules").select(SCHEDULE_SELECT).eq("id", id).maybeSingle(),
    supabase.from("finance_invoices").select(INVOICE_SELECT).eq("schedule_id", id).order("period_start", { ascending: false }).limit(24),
    loadFormOptions(supabase),
  ]);
  if (!data) notFound();
  const schedule = data as ScheduleRow;
  const invoices = (invoiceData ?? []) as InvoiceRow[];
  const today = todayIso();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/schedules" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a törzsekhez
      </Link>
      <PageHeader title={schedule.counterparty_name} description={schedule.description} />

      <ScheduleForm key={`${schedule.next_period_start}|${schedule.active}`} schedule={schedule} {...options} today={today} generatedCount={invoices.length} />

      {invoices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Ebből a törzsből készült tételek</h2>
          <Card className="divide-y divide-border-subtle p-0">
            {invoices.map((inv) => {
              const status = invoiceStatus(inv, today);
              return (
                <Link
                  key={inv.id}
                  href={`/dashboard/finance/invoices/${inv.id}`}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-background"
                >
                  <span className="w-44 shrink-0 tabular-nums">{formatPeriod(inv.period_start, inv.period_end)}</span>
                  <span className="flex-1 truncate text-muted">{inv.invoice_number ?? ""}</span>
                  <span className="tabular-nums">{formatMoney(Number(inv.gross_amount), inv.currency)}</span>
                  <Badge variant={STATUS_VARIANT[status]}>{statusLabel(status, inv.direction)}</Badge>
                </Link>
              );
            })}
          </Card>
        </div>
      )}

      <ConfirmDelete
        action={deleteSchedule}
        fields={{ id: schedule.id }}
        label="Törzs törlése"
        question="A még ki nem állított tételei is törlődnek, a kiállítottak megmaradnak. Törlöd?"
      />
    </div>
  );
}

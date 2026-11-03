import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteInvoice, markInvoice } from "../../actions";
import { loadFormOptions } from "../../data";
import { InvoiceForm } from "../../invoice-form";
import { SzamlazzPanel } from "../../szamlazz-panel";
import { ConfirmDelete } from "../../confirm-delete";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  INVOICE_SELECT,
  PAYMENT_METHOD_LABELS,
  STATUS_VARIANT,
  formatDate,
  formatMoney,
  formatPeriod,
  invoiceStatus,
  statusLabel,
  todayIso,
  type InvoiceRow,
} from "@/lib/finance";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  const backHref = back?.startsWith("/dashboard/finance") ? back : "/dashboard/finance/invoices";
  const supabase = await createClient();

  const [{ data }, options] = await Promise.all([
    supabase.from("finance_invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle(),
    loadFormOptions(supabase),
  ]);
  if (!data) notFound();
  const inv = data as InvoiceRow;
  const today = todayIso();
  const status = invoiceStatus(inv, today);

  const vatText = inv.vat_rate === null ? "Nincs ÁFA" : Number(inv.vat_rate) === 0 ? "0% / mentes" : `${Number(inv.vat_rate)}%`;
  const szamlazzFields = [
    { label: "Vevő", value: inv.counterparty_name },
    { label: "Vevő adószáma", value: inv.counterparty_tax_number ?? "" },
    { label: "Megnevezés", value: [inv.description, inv.location].filter(Boolean).join(" ") },
    { label: "Időszak", value: formatPeriod(inv.period_start, inv.period_end) },
    { label: "Nettó egységár", value: String(Number(inv.net_amount)) },
    { label: "ÁFA-kulcs", value: vatText },
    { label: "Bruttó", value: formatMoney(Number(inv.gross_amount), inv.currency) },
    { label: "Teljesítés", value: formatDate(inv.fulfillment_date) },
    { label: "Fizetési határidő", value: formatDate(inv.due_date) },
    { label: "Fizetés módja", value: PAYMENT_METHOD_LABELS[inv.payment_method] },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a listához
      </Link>
      <PageHeader
        title={inv.invoice_number || (inv.direction === "out" ? "Kiállítandó számla" : "Tétel")}
        description={`${inv.counterparty_name} · ${inv.description}`}
        action={<Badge variant={STATUS_VARIANT[status]}>{statusLabel(status, inv.direction)}</Badge>}
      />

      {inv.schedule_id && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Repeat className="h-3.5 w-3.5" />
          Számla-törzsből készült —{" "}
          <Link href={`/dashboard/finance/schedules/${inv.schedule_id}`} className="text-accent hover:underline">
            törzs megnyitása
          </Link>
        </p>
      )}

      {inv.is_planned && inv.direction === "out" && (
        <SzamlazzPanel invoiceId={inv.id} fields={szamlazzFields} today={today} />
      )}

      {(inv.paid_date || inv.bank_booked_date) && (
        <Card className="flex flex-wrap items-center gap-3 p-3 text-sm">
          {inv.paid_date && <span>Kifizetve: {formatDate(inv.paid_date)}</span>}
          {inv.bank_booked_date && <span>Bankban könyvelve: {formatDate(inv.bank_booked_date)}</span>}
          <div className="ml-auto flex gap-2">
            {inv.bank_booked_date && (
              <form action={markInvoice}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="action" value="undo_booked" />
                <Button type="submit" size="sm" variant="ghost">
                  Könyvelés visszavonása
                </Button>
              </form>
            )}
            <form action={markInvoice}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="action" value="undo_paid" />
              <Button type="submit" size="sm" variant="ghost">
                Kifizetés visszavonása
              </Button>
            </form>
          </div>
        </Card>
      )}

      <InvoiceForm invoice={inv} {...options} defaultDirection={inv.direction} returnTo={backHref} />

      <ConfirmDelete
        action={deleteInvoice}
        fields={{ id: inv.id, return_to: backHref }}
        label="Tétel törlése"
        question="Biztosan törlöd? Ez végleges."
      />
    </div>
  );
}

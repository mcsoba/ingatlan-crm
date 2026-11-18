import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteInvoice } from "../../actions";
import { PaymentStatus } from "../../payment-status";
import { loadFormOptions } from "../../data";
import { InvoiceForm } from "../../invoice-form";
import { SzamlazzPanel } from "../../szamlazz-panel";
import { ConfirmDelete } from "../../confirm-delete";
import { ReceiptsPanel, type Receipt } from "../../receipts-panel";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
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

  const [{ data }, options, { data: receiptRows }, { profile }] = await Promise.all([
    supabase.from("finance_invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle(),
    loadFormOptions(supabase),
    // A 0044-es migráció előtt a tábla nem létezik — ilyenkor üres lista
    supabase.from("finance_receipts").select("id, filename, content_type").eq("invoice_id", id).order("created_at"),
    ensureCurrentUserProfile(),
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

      <PaymentStatus inv={inv} today={today} />

      {inv.is_planned && inv.direction === "out" && (
        <SzamlazzPanel invoiceId={inv.id} fields={szamlazzFields} today={today} />
      )}

      <ReceiptsPanel agencyId={profile.agency_id} invoiceId={inv.id} receipts={(receiptRows ?? []) as Receipt[]} />


      {/* A key miatt pipálás / kiállítás után az űrlap a friss adatokkal épül újra (különben egy
          Mentés visszaírná a régi dátumokat) */}
      <InvoiceForm
        key={[inv.invoice_number, inv.is_planned, inv.issue_date, inv.paid_date, inv.paid_amount, inv.bank_booked_date].join("|")}
        invoice={inv}
        {...options}
        defaultDirection={inv.direction}
        returnTo={backHref}
      />

      <ConfirmDelete
        action={deleteInvoice}
        fields={{ id: inv.id, return_to: backHref }}
        label="Tétel törlése"
        question="Biztosan törlöd? Ez végleges."
      />
    </div>
  );
}

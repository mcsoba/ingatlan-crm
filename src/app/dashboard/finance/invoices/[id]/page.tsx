import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteInvoice } from "../../actions";
import { PaymentStatus } from "../../payment-status";
import { loadFormOptions } from "../../data";
import { InvoiceForm } from "../../invoice-form";
import { SzamlazzPanel, type SzamlazzAuto } from "../../szamlazz-panel";
import { loadSzamlazzSettings } from "@/lib/szamlazz-server";
import { defaultVatCode, parseHungarianAddress } from "@/lib/szamlazz";
import { ConfirmDelete } from "../../confirm-delete";
import { CorrectionPanel, PaymentsPanel, type LinkedInvoice, type PaymentRow } from "../../storno-panels";
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
  payableAmount,
  statusLabel,
  todayIso,
  type InvoiceRow,
} from "@/lib/finance";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string; issued?: string }>;
}) {
  const { id } = await params;
  const { back, issued } = await searchParams;
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
  // Sztornó-kapcsolat és részletfizetés (0050) — a migráció előtt ezek a lekérdezések hibát adnak, ilyenkor nincs panel
  const LINKED = "id, invoice_number, issue_date, gross_amount, description";
  const [payRes, selfRes, byRes] = await Promise.all([
    supabase.from("finance_payments").select("id, paid_date, amount, payment_method, note").eq("invoice_id", id).order("paid_date"),
    supabase.from("finance_invoices").select("corrects_invoice_id").eq("id", id).maybeSingle(),
    supabase.from("finance_invoices").select(LINKED).eq("corrects_invoice_id", id).order("issue_date"),
  ]);
  const extrasReady = !payRes.error && !selfRes.error;
  const payments = (payRes.data ?? []) as PaymentRow[];
  const correctedBy = (byRes.data ?? []) as LinkedInvoice[];
  const correctsId = (selfRes.data?.corrects_invoice_id as string | null | undefined) ?? null;
  const [{ data: correctsRow }, { data: candidateRows }] = await Promise.all([
    correctsId ? supabase.from("finance_invoices").select(LINKED).eq("id", correctsId).maybeSingle() : Promise.resolve({ data: null }),
    extrasReady && !correctsId && Number(inv.gross_amount) <= 0
      ? supabase.from("finance_invoices").select(LINKED).eq("direction", inv.direction).eq("counterparty_name", inv.counterparty_name).gt("gross_amount", 0).neq("id", id).order("issue_date", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
  ]);
  const gross = Number(inv.gross_amount);
  const cancelled = correctedBy.some((c) => Number(c.gross_amount) < 0) || (Boolean(correctsId) && gross <= 0);
  const paidSoFar = payments.reduce((s, p) => s + Number(p.amount), 0);
  const status = invoiceStatus(inv, today, { cancelled: new Set(cancelled ? [inv.id] : []), paidSoFar: new Map([[inv.id, paidSoFar]]) });
  const { data: partner } = inv.partner_id
    ? await supabase.from("finance_partners").select("kind, tax_number, address, contact_email").eq("id", inv.partner_id).maybeSingle()
    : { data: null };

  // Számlázz.hu Agent: csak kiállítandó kimenő számlánál / díjbekérőnél
  const canIssue = inv.is_planned && inv.direction === "out" && (inv.doc_type === "invoice" || inv.doc_type === "proforma");
  let szamlazzAuto: SzamlazzAuto | null = null;
  let showSetupHint = false;
  if (canIssue) {
    const settings = await loadSzamlazzSettings(profile.agency_id);
    const companySettings = settings?.get(inv.company_id);
    showSetupHint = Boolean(settings) && !companySettings;
    if (companySettings) {
      const [{ data: company }, { data: lock }] = await Promise.all([
        supabase.from("finance_companies").select("name").eq("id", inv.company_id).maybeSingle(),
        supabase.from("finance_invoices").select("szamlazz_requested_at").eq("id", inv.id).maybeSingle(),
      ]);
      const partnerAddress = (partner?.address as string | null) ?? null;
      const addr = parseHungarianAddress(partnerAddress);
      szamlazzAuto = {
        companyName: company?.name ?? "",
        eInvoice: companySettings.e_invoice,
        locked: Boolean(lock?.szamlazz_requested_at),
        docLabel: inv.doc_type === "proforma" ? "díjbekérő" : "számla",
        grossText: formatMoney(Number(inv.gross_amount), inv.currency),
        defaults: {
          buyerName: inv.counterparty_name,
          zip: addr?.zip ?? "",
          city: addr?.city ?? "",
          // Fel nem ismert címnél a teljes szöveg az utca mezőbe kerül, kézzel szétbontható
          street: addr?.street ?? partnerAddress ?? "",
          taxNumber: (partner?.tax_number as string | null) ?? inv.counterparty_tax_number ?? "",
          email: (partner?.contact_email as string | null) ?? "",
          isPerson: partner?.kind === "person",
          vatCode: defaultVatCode(inv.vat_rate === null ? null : Number(inv.vat_rate)),
        },
      };
    }
  }

  const vatText = inv.vat_rate === null ? "Nincs ÁFA" : Number(inv.vat_rate) === 0 ? "0% / mentes" : `${Number(inv.vat_rate)}%`;
  const szamlazzFields = [
    { label: "Vevő", value: inv.counterparty_name },
    { label: "Vevő adószáma", value: partner?.tax_number ?? inv.counterparty_tax_number ?? "" },
    ...(partner?.address ? [{ label: "Vevő címe", value: partner.address as string }] : []),
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

      {cancelled ? (
        <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
          <strong className="text-foreground">Sztornózva</strong> — ehhez a tételhez nem tartozik fizetés vagy banki könyvelés (az eredeti és a sztornó kiegyenlíti egymást).
        </p>
      ) : (
        <PaymentStatus inv={inv} today={today} />
      )}

      {extrasReady && !(inv.is_planned && inv.direction === "out") && !cancelled && gross > 0 && (
        <PaymentsPanel
          invoiceId={inv.id}
          payable={payableAmount(inv)}
          currency={inv.currency}
          payments={payments}
          defaultMethod={inv.payment_method}
          today={today}
          settledWithoutParts={Boolean(inv.paid_date) && payments.length === 0}
        />
      )}

      {extrasReady && (
        <CorrectionPanel
          invoiceId={inv.id}
          gross={gross}
          currency={inv.currency}
          isPlanned={inv.is_planned}
          correctedBy={correctedBy}
          corrects={(correctsRow as LinkedInvoice | null) ?? null}
          candidates={(candidateRows ?? []) as LinkedInvoice[]}
          today={today}
          back={backHref}
        />
      )}

      {issued && !inv.is_planned && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-sm text-success">
          <Check className="h-4 w-4" />
          Kiállítva a Számlázz.hu-n: {issued} — a PDF lent, a csatolmányok között
        </p>
      )}

      {inv.is_planned && inv.direction === "out" && (
        <SzamlazzPanel
          invoiceId={inv.id}
          fields={szamlazzFields}
          today={today}
          back={backHref}
          auto={szamlazzAuto}
          showSetupHint={showSetupHint}
          companyId={inv.company_id}
        />
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

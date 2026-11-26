import Link from "next/link";
import { loadInvoiceExtras } from "@/lib/finance-extras";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deletePartner } from "../../partner-actions";
import { PartnerForm } from "../../partner-form";
import { ConfirmDelete } from "../../confirm-delete";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  INVOICE_SELECT,
  PARTNER_SELECT,
  STATUS_VARIANT,
  formatDate,
  formatMoney,
  invoiceStatus,
  statusLabel,
  todayIso,
  type InvoiceRow,
  type PartnerRow,
} from "@/lib/finance";

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();
  const extras = await loadInvoiceExtras(supabase);
  const [{ data }, { data: lodgings }, { data: invoiceRows }] = await Promise.all([
    supabase.from("finance_partners").select(PARTNER_SELECT).eq("id", id).maybeSingle(),
    supabase
      .from("finance_lodgings")
      .select("id, address, landlord_id, tenant_id, lease_end, sublease_end")
      .or(`landlord_id.eq.${id},tenant_id.eq.${id}`)
      .order("address"),
    supabase.from("finance_invoices").select(INVOICE_SELECT).eq("partner_id", id).order("issue_date", { ascending: false }).limit(30),
  ]);
  if (!data) notFound();
  const partner = data as PartnerRow;
  const invoices = (invoiceRows ?? []) as InvoiceRow[];
  const today = todayIso();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/partners" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a partnerekhez
      </Link>
      <PageHeader
        title={partner.name}
        description={[partner.is_landlord && "Bérbeadó", partner.is_tenant && "Bérlő"].filter(Boolean).join(" · ") || "Partner"}
      />
      {saved && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-sm text-success">
          <Check className="h-4 w-4" />
          Mentve
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PartnerForm key={JSON.stringify(partner)} partner={partner} />
        </div>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Szállásai ({lodgings?.length ?? 0})</div>
            {(lodgings ?? []).length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">Még nincs hozzá rendelt szállás.</p>
            ) : (
              (lodgings ?? []).map((l) => (
                <Link
                  key={l.id}
                  href={`/dashboard/finance/lodgings/${l.id}`}
                  className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5 text-sm last:border-0 hover:bg-background"
                >
                  <Home className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{l.address}</span>
                  <Badge variant={l.landlord_id === id ? "accent" : "success"}>{l.landlord_id === id ? "tőle bérlünk" : "neki adjuk"}</Badge>
                </Link>
              ))
            )}
          </Card>

          <Card className="flex flex-col p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Számlák, tételek</div>
            {invoices.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">Még nincs hozzá kapcsolt tétel.</p>
            ) : (
              invoices.map((inv) => {
                const status = invoiceStatus(inv, today, extras);
                return (
                  <Link
                    key={inv.id}
                    href={`/dashboard/finance/invoices/${inv.id}`}
                    className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-sm last:border-0 hover:bg-background"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{inv.description}</div>
                      <div className="text-xs text-muted">{formatDate(inv.issue_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums">{formatMoney(Number(inv.gross_amount), inv.currency)}</div>
                      <Badge variant={STATUS_VARIANT[status]}>{statusLabel(status, inv.direction)}</Badge>
                    </div>
                  </Link>
                );
              })
            )}
          </Card>
        </div>
      </div>

      <ConfirmDelete
        action={deletePartner}
        fields={{ id: partner.id }}
        label="Partner törlése"
        question="A szállások és számlák megmaradnak, csak a partner-kapcsolat szűnik meg. Törlöd?"
      />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, Repeat, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listCompanies } from "@/lib/companies";
import { createLodgingDeposit, createLodgingSchedule, deleteLodging } from "../../partner-actions";
import { LodgingForm } from "../../lodging-form";
import { ConfirmDelete } from "../../confirm-delete";
import { loadLodgingParties } from "../../data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  INVOICE_SELECT,
  LODGING_SELECT,
  STATUS_VARIANT,
  daysUntil,
  formatDate,
  formatMoney,
  invoiceStatus,
  monthlyEquivalent,
  statusLabel,
  todayIso,
  type InvoiceRow,
  type LodgingRow,
} from "@/lib/finance";

function ActionRow({
  icon: Icon,
  title,
  sub,
  href,
  action,
  id,
  side,
  label,
}: {
  icon: typeof Repeat;
  title: string;
  sub: string;
  href?: string;
  action: (fd: FormData) => Promise<void>;
  id: string;
  side: "lease" | "sublease";
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-0">
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-success hover:underline">
          <Check className="h-3.5 w-3.5" />
          Megvan — megnyitás
        </Link>
      ) : (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="side" value={side} />
          <button type="submit" className="rounded-md border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
            {label}
          </button>
        </form>
      )}
    </div>
  );
}

export default async function LodgingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();
  const [{ data }, companies, parties, { data: schedules }, { data: invoiceRows }] = await Promise.all([
    supabase.from("finance_lodgings").select(LODGING_SELECT).eq("id", id).maybeSingle(),
    listCompanies(),
    loadLodgingParties(supabase),
    supabase.from("finance_schedules").select("id, direction, category").eq("lodging_id", id),
    supabase.from("finance_invoices").select(INVOICE_SELECT).eq("lodging_id", id).order("issue_date", { ascending: false }).limit(40),
  ]);
  if (!data) notFound();
  const lodging = data as LodgingRow;
  const invoices = (invoiceRows ?? []) as InvoiceRow[];
  const landlordParty = lodging.landlord_id ? parties.byId.get(lodging.landlord_id) : undefined;
  const tenantParty = lodging.tenant_id ? parties.byId.get(lodging.tenant_id) : undefined;
  const landlord = landlordParty?.name;
  const tenant = tenantParty?.name;
  const today = todayIso();

  const scheduleFor = (dir: "in" | "out") => (schedules ?? []).find((s) => s.direction === dir && s.category === "rent");
  const depositFor = (dir: "in" | "out") => invoices.find((i) => i.direction === dir && i.category === "deposit");
  const leaseSchedule = scheduleFor("in");
  const subSchedule = scheduleFor("out");
  const leaseDeposit = depositFor("in");
  const subDeposit = depositFor("out");

  const leaseM = monthlyEquivalent(lodging.lease_fee, lodging.lease_frequency);
  const subM = monthlyEquivalent(lodging.sublease_fee, lodging.sublease_frequency);
  const leaseDays = daysUntil(lodging.lease_end, today);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/lodgings" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a szállásokhoz
      </Link>
      <PageHeader
        title={lodging.address}
        description={[landlord && `Bérbeadó: ${landlord}`, tenant && `Bérlő: ${tenant}`].filter(Boolean).join(" · ") || "Szállás"}
        action={
          leaseDays !== null && leaseDays <= 60 ? (
            <Badge variant={leaseDays < 0 ? "danger" : "warning"}>
              {leaseDays < 0 ? "A bérleti szerződés lejárt" : `A bérleti szerződés ${leaseDays} nap múlva lejár`}
            </Badge>
          ) : undefined
        }
      />
      {saved && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-sm text-success">
          <Check className="h-4 w-4" />
          Mentve
        </p>
      )}

      <Card className="flex flex-col p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">Számlázás ebből a szállásból</div>
          <div className="text-xs text-muted">Egy kattintással készül az ismétlődő tétel a szerződés adataiból — utána a rendszer minden hónapban magától szól.</div>
        </div>
        <ActionRow
          icon={ArrowDownLeft}
          title={`Bérleti díj a bérbeadónak${landlord ? ` (${landlord})` : ""}`}
          sub={leaseM !== null ? `${formatMoney(leaseM)} / hó — kiadás` : "Előbb add meg a bérleti díjat"}
          href={leaseSchedule ? `/dashboard/finance/schedules/${leaseSchedule.id}` : undefined}
          action={createLodgingSchedule}
          id={id}
          side="lease"
          label="Ismétlődő tétel létrehozása"
        />
        <ActionRow
          icon={ArrowUpRight}
          title={`Kiszámlázott díj a bérlőnek${tenant ? ` (${tenant})` : ""}`}
          sub={subM !== null ? `${formatMoney(subM)} / hó — bevétel` : "Előbb add meg, mennyiért adjuk tovább"}
          href={subSchedule ? `/dashboard/finance/schedules/${subSchedule.id}` : undefined}
          action={createLodgingSchedule}
          id={id}
          side="sublease"
          label="Ismétlődő számla létrehozása"
        />
        <ActionRow
          icon={Wallet}
          title="Kaució, amit mi fizettünk a bérbeadónak"
          sub={lodging.lease_deposit !== null ? formatMoney(Number(lodging.lease_deposit)) : "Nincs megadva"}
          href={leaseDeposit ? `/dashboard/finance/invoices/${leaseDeposit.id}` : undefined}
          action={createLodgingDeposit}
          id={id}
          side="lease"
          label="Kaució tétel létrehozása"
        />
        <ActionRow
          icon={Wallet}
          title="Kaució, amit a bérlő fizet nekünk"
          sub={lodging.sublease_deposit !== null ? formatMoney(Number(lodging.sublease_deposit)) : "Nincs megadva"}
          href={subDeposit ? `/dashboard/finance/invoices/${subDeposit.id}` : undefined}
          action={createLodgingDeposit}
          id={id}
          side="sublease"
          label="Díjbekérő létrehozása"
        />
      </Card>

      <LodgingForm
        key={JSON.stringify(lodging)}
        lodging={lodging}
        companies={companies}
        landlords={parties.landlords}
        tenants={parties.tenants}
        landlord={landlordParty}
        tenant={tenantParty}
      />

      <Card className="flex flex-col p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Tételek ehhez a szálláshoz ({invoices.length})</div>
        {invoices.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Még nincs hozzá kapcsolt számla vagy tétel.</p>
        ) : (
          invoices.map((inv) => {
            const status = invoiceStatus(inv, today);
            return (
              <Link
                key={inv.id}
                href={`/dashboard/finance/invoices/${inv.id}`}
                className="flex items-center gap-3 border-b border-border-subtle px-4 py-2 text-sm last:border-0 hover:bg-background"
              >
                <Badge variant={STATUS_VARIANT[status]}>{statusLabel(status, inv.direction)}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    {inv.counterparty_name} · {inv.description}
                  </div>
                  <div className="text-xs text-muted">{formatDate(inv.issue_date)}</div>
                </div>
                <div className={`tabular-nums ${inv.direction === "out" ? "text-success" : ""}`}>
                  {inv.direction === "out" ? "+" : "−"}
                  {formatMoney(Number(inv.gross_amount), inv.currency)}
                </div>
              </Link>
            );
          })
        )}
      </Card>

      <ConfirmDelete
        action={deleteLodging}
        fields={{ id: lodging.id }}
        label="Szállás törlése"
        question="A számlák és törzsek megmaradnak, csak a szállás-kapcsolat szűnik meg. Törlöd?"
      />
    </div>
  );
}

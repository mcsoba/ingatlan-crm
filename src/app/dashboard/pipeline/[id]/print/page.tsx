import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  Mail,
  Phone,
  StickyNote,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { getAccentPreset } from "@/lib/accent-presets";
import { Card } from "@/components/ui/card";
import { PrintButton } from "./print-button";

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
  checklist: "Checklist",
};

export default async function DealPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [{ data: deal }, { data: agencyBranding }, { data: activities }] =
    await Promise.all([
      supabase
        .from("deals")
        .select(
          "id, stage_id, notes, deal_amount, commission_rate, pipeline_stages(name), contacts(name, email, phone), properties(address, price, size_sqm)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("agencies")
        .select("name, logo_path, accent_preset")
        .eq("id", profile.agency_id)
        .single(),
      supabase
        .from("activities")
        .select("type, content, due_at, done, created_at")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!deal) notFound();

  const dealRow = deal as unknown as {
    id: string;
    notes: string | null;
    deal_amount: number | null;
    commission_rate: number | null;
    pipeline_stages: { name: string } | null;
    contacts: { name: string; email: string | null; phone: string | null } | null;
    properties: { address: string; price: number | null; size_sqm: number | null } | null;
  };

  const contact = dealRow.contacts;
  const property = dealRow.properties;
  const commissionAmount =
    dealRow.deal_amount != null && dealRow.commission_rate != null
      ? (dealRow.deal_amount * dealRow.commission_rate) / 100
      : null;

  const checklistItems = (activities ?? []).filter((a) => a.type === "checklist");
  const notesItems = (activities ?? []).filter((a) => a.type !== "checklist");

  const preset = getAccentPreset(agencyBranding?.accent_preset);
  const logoUrl = agencyBranding?.logo_path
    ? supabase.storage.from("agency-logos").getPublicUrl(agencyBranding.logo_path).data.publicUrl
    : null;

  return (
    <main
      className="mx-auto max-w-2xl print:max-w-full"
      style={
        {
          "--accent": preset.accent,
          "--accent-hover": preset.hover,
          "--accent-soft": preset.soft,
        } as CSSProperties
      }
    >
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/pipeline/${id}`}
          className="text-sm text-muted hover:text-accent"
        >
          ← Vissza a dealhez
        </Link>
        <PrintButton />
      </div>

      <div className="flex items-center gap-2.5 border-b border-border pb-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <Building2 className="h-5 w-5" strokeWidth={2.25} />
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-foreground">
            {agencyBranding?.name ?? "Ingatlan CRM"}
          </div>
          <div className="text-xs text-muted">
            Deal-összefoglaló ·{" "}
            {new Date().toLocaleDateString("hu-HU", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
        {contact?.name ?? "Ismeretlen kontakt"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Szakasz: {dealRow.pipeline_stages?.name ?? "—"}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 print:grid-cols-2">
        <Card className="p-4 text-sm">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <User className="h-3.5 w-3.5" strokeWidth={1.75} />
            Kontakt
          </div>
          <div className="font-medium text-foreground">
            {contact?.name ?? "—"}
          </div>
          {contact?.email && (
            <div className="mt-1 flex items-center gap-1.5 text-muted">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              {contact.email}
            </div>
          )}
          {contact?.phone && (
            <div className="mt-1 flex items-center gap-1.5 text-muted">
              <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
              {contact.phone}
            </div>
          )}
        </Card>

        <Card className="p-4 text-sm">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ingatlan
          </div>
          {property ? (
            <>
              <div className="font-medium text-foreground">{property.address}</div>
              <div className="mt-1 text-muted">
                {[
                  property.price ? `${property.price.toLocaleString("hu-HU")} Ft` : null,
                  property.size_sqm ? `${property.size_sqm} m²` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
            </>
          ) : (
            <div className="text-muted">Nincs kapcsolódó ingatlan</div>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-4 text-sm">
        <div className="mb-2 text-xs font-medium text-muted">Ügylet-értékek</div>
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          <div>
            <span className="text-muted">Végleges ár: </span>
            <span className="font-medium text-foreground">
              {dealRow.deal_amount != null
                ? `${dealRow.deal_amount.toLocaleString("hu-HU")} Ft`
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-muted">Jutalék: </span>
            <span className="font-medium text-foreground">
              {dealRow.commission_rate != null ? `${dealRow.commission_rate}%` : "—"}
            </span>
          </div>
          <div>
            <span className="text-muted">Várható jutalék: </span>
            <span className="font-medium text-foreground">
              {commissionAmount != null
                ? `${commissionAmount.toLocaleString("hu-HU", { maximumFractionDigits: 0 })} Ft`
                : "—"}
            </span>
          </div>
        </div>
      </Card>

      {dealRow.notes && (
        <Card className="mt-4 p-4 text-sm">
          <div className="mb-1 text-xs font-medium text-muted">Jegyzet</div>
          <p className="whitespace-pre-line text-foreground">{dealRow.notes}</p>
        </Card>
      )}

      {checklistItems.length > 0 && (
        <Card className="mt-4 p-4 text-sm">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tranzakciós checklist
          </div>
          <ul className="flex flex-col gap-1.5">
            {checklistItems.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    item.done
                      ? "border-accent bg-accent text-white"
                      : "border-border text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={item.done ? "text-muted line-through" : "text-foreground"}>
                  {item.content}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {notesItems.length > 0 && (
        <Card className="mt-4 p-4 text-sm">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} />
            Aktivitások
          </div>
          <ul className="flex flex-col gap-2">
            {notesItems.slice(0, 8).map((item, i) => (
              <li key={i} className="border-t border-border-subtle pt-2 first:border-0 first:pt-0">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{TYPE_LABELS[item.type] ?? item.type}</span>
                  <span>
                    {new Date(item.created_at).toLocaleDateString("hu-HU")}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-line text-foreground">{item.content}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}

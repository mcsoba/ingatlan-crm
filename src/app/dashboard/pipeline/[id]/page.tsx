import Link from "next/link";
import { notFound } from "next/navigation";
import { User, Building2, Trash2, ClipboardCheck, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteDeal,
  seedTransactionChecklist,
  updateDealCommission,
  updateDealNotes,
  updateDealOwner,
  updateDealStage,
} from "../actions";
import { DealFollowUpPanel } from "./follow-up-panel";
import { AskAssistantPanel } from "./ask-assistant-panel";
import { ActivityPanel } from "../../activities/activity-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  inputClass,
  labelClass,
  fieldGroupClass,
  sectionLabelClass,
} from "@/components/ui/styles";

type DealDetailRow = {
  id: string;
  stage_id: string;
  owner_id: string | null;
  notes: string | null;
  deal_amount: number | null;
  commission_rate: number | null;
  contacts: { id: string; name: string; email: string | null; phone: string | null } | null;
  properties: { id: string; address: string; price: number | null } | null;
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: deal }, { data: stages }, { data: members }, { data: activities, error: activitiesError }] =
    await Promise.all([
      supabase
        .from("deals")
        .select(
          "id, stage_id, owner_id, notes, deal_amount, commission_rate, contacts(id, name, email, phone), properties(id, address, price)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("pipeline_stages").select("id, name").order("position"),
      supabase.from("profiles").select("id, full_name").order("created_at"),
      supabase
        .from("activities")
        .select("id, type, content, due_at, done")
        .eq("deal_id", id)
        .order("done")
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

  if (activitiesError) throw activitiesError;
  if (!deal) notFound();

  const dealRow = deal as unknown as DealDetailRow;
  const contact = dealRow.contacts;
  const property = dealRow.properties;
  const stageName = stages?.find((s) => s.id === dealRow.stage_id)?.name ?? "—";
  const updateStageWithId = updateDealStage.bind(null, dealRow.id);
  const updateOwnerWithId = updateDealOwner.bind(null, dealRow.id);
  const updateNotesWithId = updateDealNotes.bind(null, dealRow.id);
  const updateCommissionWithId = updateDealCommission.bind(null, dealRow.id);
  const seedChecklistWithId = seedTransactionChecklist.bind(null, dealRow.id);

  const memberEmailById = new Map<string, string>();
  if (members && members.length > 0) {
    const admin = createAdminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
    const memberIds = new Set(members.map((m) => m.id));
    for (const user of usersPage?.users ?? []) {
      if (memberIds.has(user.id)) memberEmailById.set(user.id, user.email ?? "");
    }
  }

  const hasChecklist = (activities ?? []).some((a) => a.type === "checklist");
  const commissionAmount =
    dealRow.deal_amount != null && dealRow.commission_rate != null
      ? (dealRow.deal_amount * dealRow.commission_rate) / 100
      : null;

  return (
    <div className="max-w-md">
      <PageHeader
        title={contact?.name ?? "Ismeretlen kontakt"}
        action={
          <Link
            href="/dashboard/pipeline"
            className="text-sm text-muted hover:text-accent"
          >
            ← Pipeline
          </Link>
        }
      />

      <div className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
              <User className="h-3.5 w-3.5" strokeWidth={1.75} />
              Kontakt
            </div>
            {contact ? (
              <>
                <Link
                  href={`/dashboard/contacts/${contact.id}/edit`}
                  className="font-medium text-foreground hover:text-accent"
                >
                  {contact.name}
                </Link>
                <div className="mt-0.5 truncate text-muted">
                  {contact.email || contact.phone || "—"}
                </div>
              </>
            ) : (
              <div className="text-muted">Nincs kontakt</div>
            )}
          </Card>

          <Card className="p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Ingatlan
            </div>
            {property ? (
              <Link
                href={`/dashboard/properties/${property.id}/edit`}
                className="font-medium text-foreground hover:text-accent"
              >
                {property.address}
                {property.price && (
                  <span className="block font-normal text-muted">
                    {property.price.toLocaleString("hu-HU")} Ft
                  </span>
                )}
              </Link>
            ) : (
              <div className="text-muted">Nincs kapcsolódó ingatlan</div>
            )}
          </Card>
        </div>

        <Card className="border-accent/20 bg-accent-soft/40 p-4">
          <AskAssistantPanel dealId={dealRow.id} />
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <form action={updateStageWithId} className="flex flex-col gap-1.5">
            <span className={labelClass}>Szakasz</span>
            <div className="flex gap-2">
              <select
                name="stage_id"
                defaultValue={dealRow.stage_id}
                className={`${inputClass} flex-1`}
              >
                {stages?.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                Mentés
              </Button>
            </div>
          </form>

          <form action={updateOwnerWithId} className="flex flex-col gap-1.5">
            <span className={labelClass}>Felelős ügynök</span>
            <div className="flex gap-2">
              <select
                name="owner_id"
                defaultValue={dealRow.owner_id ?? ""}
                className={`${inputClass} flex-1`}
              >
                <option value="">Nincs hozzárendelve</option>
                {(members ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || memberEmailById.get(member.id) || "Ismeretlen"}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                Mentés
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-4">
          <form action={updateNotesWithId} className={fieldGroupClass}>
            <span className={labelClass}>Jegyzet</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={dealRow.notes ?? ""}
              className={inputClass}
            />
            <Button type="submit" variant="secondary" size="sm" className="self-start">
              Jegyzet mentése
            </Button>
          </form>
        </Card>

        <Card className="p-4">
          <form action={updateCommissionWithId} className="flex flex-col gap-2">
            <span className={labelClass}>
              <span className="inline-flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" strokeWidth={1.75} />
                Jutalék
              </span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className={fieldGroupClass}>
                <span className="text-xs text-muted">Végleges ár (Ft)</span>
                <input
                  name="deal_amount"
                  type="number"
                  step="1"
                  defaultValue={dealRow.deal_amount ?? ""}
                  className={inputClass}
                />
              </div>
              <div className={fieldGroupClass}>
                <span className="text-xs text-muted">Jutalék (%)</span>
                <input
                  name="commission_rate"
                  type="number"
                  step="0.1"
                  defaultValue={dealRow.commission_rate ?? ""}
                  className={inputClass}
                />
              </div>
            </div>
            {commissionAmount != null && (
              <div className="text-sm text-foreground">
                Várható jutalék:{" "}
                <span className="font-semibold">
                  {commissionAmount.toLocaleString("hu-HU", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  Ft
                </span>
              </div>
            )}
            <Button type="submit" variant="secondary" size="sm" className="self-start">
              Mentés
            </Button>
          </form>
        </Card>

        <Card className="p-4">
          <DealFollowUpPanel
            contactName={contact?.name ?? ""}
            stageName={stageName}
            propertyAddress={property?.address ?? null}
            notes={dealRow.notes ?? ""}
          />
        </Card>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className={sectionLabelClass}>Aktivitások</h2>
            {!hasChecklist && (
              <form action={seedChecklistWithId}>
                <Button type="submit" variant="secondary" size="sm">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Tranzakciós checklist létrehozása
                </Button>
              </form>
            )}
          </div>
          <ActivityPanel
            dealId={dealRow.id}
            activities={activities ?? []}
            redirectTo={`/dashboard/pipeline/${dealRow.id}`}
          />
        </div>

        <form action={deleteDeal} className="border-t border-border-subtle pt-4">
          <input type="hidden" name="id" value={dealRow.id} />
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Deal törlése
          </button>
        </form>
      </div>
    </div>
  );
}

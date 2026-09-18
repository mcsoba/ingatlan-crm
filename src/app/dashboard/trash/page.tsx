import { Trash2, RotateCcw, User, Building2, Kanban } from "lucide-react";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { restoreRecord } from "./actions";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "ma törölve";
  if (days === 1) return "tegnap törölve";
  return `${days} napja törölve`;
}

type TrashRow = { id: string; label: string; deletedAt: string };

export default async function TrashPage() {
  const { profile } = await ensureCurrentUserProfile();
  const admin = createAdminClient();
  const cutoff = new Date(new Date().getTime() - THIRTY_DAYS_MS).toISOString();

  const [{ data: contacts }, { data: properties }, { data: deals }] = await Promise.all([
    admin
      .from("contacts")
      .select("id, name, deleted_at")
      .eq("agency_id", profile.agency_id)
      .not("deleted_at", "is", null)
      .gte("deleted_at", cutoff)
      .order("deleted_at", { ascending: false }),
    admin
      .from("properties")
      .select("id, address, deleted_at")
      .eq("agency_id", profile.agency_id)
      .not("deleted_at", "is", null)
      .gte("deleted_at", cutoff)
      .order("deleted_at", { ascending: false }),
    admin
      .from("deals")
      .select("id, deleted_at, contacts(name)")
      .eq("agency_id", profile.agency_id)
      .not("deleted_at", "is", null)
      .gte("deleted_at", cutoff)
      .order("deleted_at", { ascending: false }),
  ]);

  const contactRows: TrashRow[] = (contacts ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    deletedAt: c.deleted_at as string,
  }));
  const propertyRows: TrashRow[] = (properties ?? []).map((p) => ({
    id: p.id,
    label: p.address,
    deletedAt: p.deleted_at as string,
  }));
  const dealRows: TrashRow[] = (deals ?? []).map((d) => {
    const contact = d.contacts as unknown as { name: string } | null;
    return {
      id: d.id,
      label: contact?.name ?? "Ismeretlen kontakt",
      deletedAt: d.deleted_at as string,
    };
  });

  const isEmpty =
    contactRows.length === 0 && propertyRows.length === 0 && dealRows.length === 0;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Lomtár"
        description="A törölt kontaktok, ingatlanok és dealek 30 napig itt visszaállíthatók, utána véglegesen törlődnek."
      />

      {isEmpty ? (
        <div className="mt-6">
          <EmptyState
            icon={Trash2}
            title="A lomtár üres"
            description="Amit törölsz, 30 napig itt megtalálod és visszaállíthatod."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <TrashSection title="Kontaktok" icon={User} table="contacts" rows={contactRows} />
          <TrashSection title="Ingatlanok" icon={Building2} table="properties" rows={propertyRows} />
          <TrashSection title="Dealek" icon={Kanban} table="deals" rows={dealRows} />
        </div>
      )}
    </div>
  );
}

function TrashSection({
  title,
  icon: Icon,
  table,
  rows,
}: {
  title: string;
  icon: typeof User;
  table: string;
  rows: TrashRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {title}
      </h2>
      <Card className="divide-y divide-border-subtle">
        {rows.map((row) => {
          const restoreWithArgs = restoreRecord.bind(null, table, row.id);
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <div className="font-medium text-foreground">{row.label}</div>
                <div className="text-xs text-muted">{daysAgo(row.deletedAt)}</div>
              </div>
              <form action={restoreWithArgs}>
                <Button type="submit" variant="secondary" size="sm">
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Visszaállítás
                </Button>
              </form>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

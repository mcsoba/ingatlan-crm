import Link from "next/link";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const TABLE_LABELS: Record<string, string> = {
  contacts: "Kontakt",
  properties: "Ingatlan",
  deals: "Deal",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "Létrehozva",
  update: "Módosítva",
  delete: "Törölve",
  restore: "Visszaállítva",
};

const ACTION_VARIANTS: Record<string, BadgeVariant> = {
  insert: "success",
  update: "accent",
  delete: "danger",
  restore: "success",
};

function recordHref(tableName: string, recordId: string): string | null {
  if (tableName === "contacts") return `/dashboard/contacts/${recordId}/edit`;
  if (tableName === "properties") return `/dashboard/properties/${recordId}/edit`;
  if (tableName === "deals") return `/dashboard/pipeline/${recordId}`;
  return null;
}

export default async function AuditLogPage() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, record_label, changed_by, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const changerIds = Array.from(
    new Set((rows ?? []).map((r) => r.changed_by).filter((id): id is string => Boolean(id))),
  );

  const nameById = new Map<string, string>();
  if (changerIds.length > 0) {
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", changerIds);

    const missingIds = new Set(changerIds);
    for (const member of members ?? []) {
      if (member.full_name) {
        nameById.set(member.id, member.full_name);
        missingIds.delete(member.id);
      }
    }

    if (missingIds.size > 0) {
      const admin = createAdminClient();
      const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
      for (const user of usersPage?.users ?? []) {
        if (missingIds.has(user.id) && user.email) nameById.set(user.id, user.email);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Előzmények"
        description="Kik és mikor hoztak létre, módosítottak vagy töröltek kontaktot, ingatlant vagy dealt."
        helpText="Az utolsó 100 esemény, legújabb elöl. A 'Rendszer' bejegyzések automatikus forrásból jöttek (pl. weboldali érdeklődés, ütemezett feladat), nem egy csapattag műveletéből."
      />

      {!rows || rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Még nincs rögzített esemény"
          description="Amint valaki kontaktot, ingatlant vagy dealt hoz létre, módosít vagy töröl, itt fog megjelenni."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Időpont</th>
                  <th className="px-4 py-3 font-medium">Típus</th>
                  <th className="px-4 py-3 font-medium">Művelet</th>
                  <th className="px-4 py-3 font-medium">Rekord</th>
                  <th className="px-4 py-3 font-medium">Ki</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const href =
                    row.action !== "delete" ? recordHref(row.table_name, row.record_id) : null;

                  return (
                    <tr key={row.id} className="border-b border-border-subtle last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {new Date(row.created_at).toLocaleString("hu-HU", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {TABLE_LABELS[row.table_name] ?? row.table_name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ACTION_VARIANTS[row.action] ?? "neutral"}>
                          {ACTION_LABELS[row.action] ?? row.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {href ? (
                          <Link href={href} className="hover:text-accent-hover hover:underline">
                            {row.record_label || "—"}
                          </Link>
                        ) : (
                          row.record_label || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {(row.changed_by && nameById.get(row.changed_by)) || "Rendszer"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

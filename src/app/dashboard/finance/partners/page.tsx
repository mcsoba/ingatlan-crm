import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { PARTNER_KIND_LABELS, PARTNER_SELECT, type PartnerRow } from "@/lib/finance";

const ROLE_FILTERS = [
  { value: "", label: "Mindenki" },
  { value: "landlord", label: "Bérbeadók (tőlük bérlünk)" },
  { value: "tenant", label: "Bérlők (nekik adjuk tovább)" },
];

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const role = sp.role === "landlord" || sp.role === "tenant" ? sp.role : "";
  const q = sp.q?.trim().replace(/[%,()]/g, " ") ?? "";
  const supabase = await createClient();

  let query = supabase.from("finance_partners").select(PARTNER_SELECT).order("name");
  if (role === "landlord") query = query.eq("is_landlord", true);
  if (role === "tenant") query = query.eq("is_tenant", true);
  if (q) query = query.or(["name", "tax_number", "contact_name", "address"].map((c) => `${c}.ilike.%${q}%`).join(","));
  const { data, error } = await query;
  if (isMissingTable(error)) return <MigrationNotice file="0045_finance_partners_lodgings.sql" />;
  const partners = (data ?? []) as PartnerRow[];

  const { data: lodgings } = await supabase.from("finance_lodgings").select("landlord_id, tenant_id");
  const lodgingCount = new Map<string, number>();
  for (const l of lodgings ?? []) {
    for (const id of [l.landlord_id, l.tenant_id]) if (id) lodgingCount.set(id, (lodgingCount.get(id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Partnerek"
        description="Akiktől a szállásokat béreljük (bérbeadók) és akiknek továbbadjuk (bérlő cégek). Az adószám, bankszámla és cím itt van egy helyen — a számlák és törzsek innen veszik."
        action={
          <Link href={`/dashboard/finance/partners/new${role ? `?role=${role}` : ""}`} className={buttonVariants("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" />
            Új partner
          </Link>
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q} placeholder="Keresés (név, adószám, kapcsolattartó, cím)" className={`${inputClass} min-w-[220px] flex-1 py-1.5`} />
        <select name="role" defaultValue={role} className={`${inputClass} w-auto py-1.5`}>
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants("secondary", "sm")}>
          Szűrés
        </button>
      </form>

      {partners.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q || role ? "Nincs a szűrésnek megfelelő partner" : "Még nincs partner"}
          description="Vegyél fel egy bérbeadót vagy bérlő céget — vagy egyszerűen írd be a nevét egy szállás felvételénél, és a rendszer magától létrehozza."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Név</th>
                <th className="px-2 py-2 font-medium">Szerepe</th>
                <th className="px-2 py-2 font-medium">Adószám</th>
                <th className="px-2 py-2 font-medium">Kapcsolattartó</th>
                <th className="px-4 py-2 text-right font-medium">Szállás</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-border-subtle last:border-0 hover:bg-background/60">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/finance/partners/${p.id}`} className="font-medium text-foreground hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted">{PARTNER_KIND_LABELS[p.kind]}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.is_landlord && <Badge variant="accent">Bérbeadó</Badge>}
                      {p.is_tenant && <Badge variant="success">Bérlő</Badge>}
                    </div>
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {p.tax_number || <span className="text-xs text-warning">hiányzik</span>}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {p.contact_name && <div className="text-foreground">{p.contact_name}</div>}
                    {p.contact_phone && <div className="text-muted">{p.contact_phone}</div>}
                    {p.contact_email && <div className="text-muted">{p.contact_email}</div>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{lodgingCount.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

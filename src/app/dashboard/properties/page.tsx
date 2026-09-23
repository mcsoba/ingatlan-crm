import Link from "next/link";
import { Plus, Search, Building2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PropertiesGrid } from "./properties-grid";
import { ImportPropertiesButton } from "./import-button";
import { STATUS_LABELS } from "./constants";
import { listAgencyTags } from "../tags/actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; priceMin?: string; priceMax?: string; status?: string; tag?: string }>;
}) {
  const { q, priceMin, priceMax, status, tag } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("properties")
    .select("id, address, price, size_sqm, status, view_count")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("address", `%${q}%`);
  if (priceMin) query = query.gte("price", Number(priceMin));
  if (priceMax) query = query.lte("price", Number(priceMax));
  if (status) query = query.eq("status", status);

  if (tag) {
    const { data: taggedRows } = await supabase
      .from("property_tags")
      .select("property_id")
      .eq("tag_id", tag);
    const ids = (taggedRows ?? []).map((r) => r.property_id);
    query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const [{ data: properties, error }, allTags] = await Promise.all([
    query,
    listAgencyTags(),
  ]);

  if (error) throw error;

  const hasFilters = Boolean(q || priceMin || priceMax || status || tag);

  const propertyIds = properties.map((p) => p.id);
  const coverPhotoByProperty = new Map<string, string>();
  const tagsByProperty = new Map<string, { id: string; name: string; color: string }[]>();
  if (propertyIds.length > 0) {
    const [{ data: photos }, { data: tagLinks }] = await Promise.all([
      supabase
        .from("property_photos")
        .select("property_id, path")
        .in("property_id", propertyIds)
        .order("position", { ascending: true }),
      supabase
        .from("property_tags")
        .select("property_id, tags(id, name, color)")
        .in("property_id", propertyIds),
    ]);

    for (const photo of photos ?? []) {
      if (!coverPhotoByProperty.has(photo.property_id)) {
        coverPhotoByProperty.set(photo.property_id, photo.path);
      }
    }

    for (const link of tagLinks ?? []) {
      const t = link.tags as unknown as { id: string; name: string; color: string } | null;
      if (!t) continue;
      const list = tagsByProperty.get(link.property_id) ?? [];
      list.push(t);
      tagsByProperty.set(link.property_id, list);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingatlanok"
        description="Az iroda aktuális kínálata."
        action={
          <>
            <a
              href="/dashboard/properties/export"
              className={buttonVariants("secondary")}
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Export CSV
            </a>
            <ImportPropertiesButton />
            <Link
              href="/dashboard/properties/new"
              className={buttonVariants("primary")}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Új ingatlan
            </Link>
          </>
        }
      />

      <form className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Keresés cím szerint…"
            className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm placeholder:text-muted-subtle"
          />
        </div>
        <input
          type="number"
          name="priceMin"
          defaultValue={priceMin ?? ""}
          placeholder="Ártól (Ft)"
          className={`${inputClass} w-32`}
        />
        <input
          type="number"
          name="priceMax"
          defaultValue={priceMax ?? ""}
          placeholder="Árig (Ft)"
          className={`${inputClass} w-32`}
        />
        <select name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">Minden státusz</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select name="tag" defaultValue={tag ?? ""} className={inputClass}>
            <option value="">Minden címke</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={buttonVariants("secondary")}>
          Szűrés
        </button>
        {hasFilters && (
          <Link
            href="/dashboard/properties"
            className={buttonVariants("ghost")}
          >
            Törlés
          </Link>
        )}
      </form>

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasFilters ? "Nincs a szűrésnek megfelelő ingatlan" : "Még nincs ingatlan"}
          description={
            hasFilters
              ? "Próbálj más keresőszót vagy tartományt."
              : "Vegyél fel egy ingatlant a kínálatba."
          }
        />
      ) : (
        <PropertiesGrid
          allTags={allTags}
          properties={properties.map((property) => {
            const coverPath = coverPhotoByProperty.get(property.id);
            return {
              ...property,
              tags: tagsByProperty.get(property.id) ?? [],
              photoUrl: coverPath
                ? supabase.storage.from("property-photos").getPublicUrl(coverPath)
                    .data.publicUrl
                : null,
            };
          })}
        />
      )}
    </div>
  );
}

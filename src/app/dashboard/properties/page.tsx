import Link from "next/link";
import { Plus, Search, Building2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PropertiesGrid } from "./properties-grid";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; priceMin?: string; priceMax?: string }>;
}) {
  const { q, priceMin, priceMax } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("properties")
    .select("id, address, price, size_sqm")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("address", `%${q}%`);
  if (priceMin) query = query.gte("price", Number(priceMin));
  if (priceMax) query = query.lte("price", Number(priceMax));

  const { data: properties, error } = await query;

  if (error) throw error;

  const hasFilters = Boolean(q || priceMin || priceMax);

  const propertyIds = properties.map((p) => p.id);
  const coverPhotoByProperty = new Map<string, string>();
  if (propertyIds.length > 0) {
    const { data: photos } = await supabase
      .from("property_photos")
      .select("property_id, path")
      .in("property_id", propertyIds)
      .order("position", { ascending: true });

    for (const photo of photos ?? []) {
      if (!coverPhotoByProperty.has(photo.property_id)) {
        coverPhotoByProperty.set(photo.property_id, photo.path);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingatlanok"
        description="Az iroda aktuális kínálata."
        action={
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/properties/export"
              className={buttonVariants("secondary")}
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Export CSV
            </a>
            <Link
              href="/dashboard/properties/new"
              className={buttonVariants("primary")}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Új ingatlan
            </Link>
          </div>
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
          properties={properties.map((property) => {
            const coverPath = coverPhotoByProperty.get(property.id);
            return {
              ...property,
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

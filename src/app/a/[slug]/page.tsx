import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Ruler, Wallet } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccentPreset } from "@/lib/accent-presets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const loadAgency = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("id, name, logo_path, accent_preset")
    .eq("slug", slug)
    .maybeSingle();
  return { admin, agency };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { admin, agency } = await loadAgency(slug);
  if (!agency) return { title: "Iroda nem található" };

  const title = `${agency.name} — ingatlanjaink`;
  const description = "Elérhető ingatlanaink egy helyen.";
  const imageUrl = agency.logo_path
    ? admin.storage.from("agency-logos").getPublicUrl(agency.logo_path).data.publicUrl
    : undefined;

  return {
    title,
    description,
    openGraph: { title, description, images: imageUrl ? [imageUrl] : undefined },
  };
}

export default async function AgencyCatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { admin, agency } = await loadAgency(slug);

  if (!agency) notFound();

  const { data: properties } = await admin
    .from("properties")
    .select("id, address, price, size_sqm, status, created_at")
    .eq("agency_id", agency.id)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  const propertyIds = (properties ?? []).map((p) => p.id);
  const { data: photoRows } = propertyIds.length
    ? await admin
        .from("property_photos")
        .select("property_id, path, position")
        .in("property_id", propertyIds)
        .order("position", { ascending: true })
    : { data: [] as { property_id: string; path: string; position: number }[] };

  const firstPhotoByProperty = new Map<string, string>();
  for (const row of photoRows ?? []) {
    if (!firstPhotoByProperty.has(row.property_id)) {
      firstPhotoByProperty.set(
        row.property_id,
        admin.storage.from("property-photos").getPublicUrl(row.path).data.publicUrl,
      );
    }
  }

  const preset = getAccentPreset(agency.accent_preset);
  const logoUrl = agency.logo_path
    ? admin.storage.from("agency-logos").getPublicUrl(agency.logo_path).data.publicUrl
    : null;

  return (
    <main
      className="mx-auto min-h-screen max-w-4xl bg-background px-6 py-10"
      style={
        {
          "--accent": preset.accent,
          "--accent-hover": preset.hover,
          "--accent-soft": preset.soft,
        } as CSSProperties
      }
    >
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <Building2 className="h-4.5 w-4.5" strokeWidth={2.25} />
          </div>
        )}
        <h1 className="text-lg font-semibold text-foreground">{agency.name}</h1>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {(properties ?? []).length > 0
          ? `${(properties ?? []).length} elérhető ingatlan`
          : "Jelenleg elérhető ingatlanok"}
      </p>

      {(properties ?? []).length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Building2}
            title="Jelenleg nincs elérhető ingatlan"
            description="Nézzen vissza később, vagy keresse az irodát közvetlenül."
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(properties ?? []).map((property) => {
            const photoUrl = firstPhotoByProperty.get(property.id);
            return (
              <Link key={property.id} href={`/p/${property.id}`}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  <div className="aspect-[4/3] w-full bg-background">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-subtle">
                        <Building2 className="h-8 w-8" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">
                      {property.address}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      {property.price && (
                        <span className="flex items-center gap-1">
                          <Wallet className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {property.price.toLocaleString("hu-HU")} Ft
                        </span>
                      )}
                      {property.size_sqm && (
                        <span className="flex items-center gap-1">
                          <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {property.size_sqm} m²
                        </span>
                      )}
                    </div>
                    <Badge variant="success" className="w-fit">
                      Elérhető
                    </Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

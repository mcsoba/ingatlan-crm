import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Ruler, Wallet } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccentPreset } from "@/lib/accent-presets";
import { PrintButton } from "./print-button";
import { LeadForm } from "./lead-form";

const loadProperty = cache(async (propertyId: string) => {
  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id, agency_id, address, price, size_sqm, status, ai_description, features")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  return { admin, property };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}): Promise<Metadata> {
  const { propertyId } = await params;
  const { admin, property } = await loadProperty(propertyId);
  if (!property) return { title: "Ingatlan nem található" };

  const { data: photoRow } = await admin
    .from("property_photos")
    .select("path")
    .eq("property_id", propertyId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const priceLabel = property.price ? `${property.price.toLocaleString("hu-HU")} Ft` : null;
  const sizeLabel = property.size_sqm ? `${property.size_sqm} m²` : null;
  const description =
    [priceLabel, sizeLabel].filter(Boolean).join(" · ") ||
    property.ai_description ||
    "Ingatlan részletei";
  const imageUrl = photoRow
    ? admin.storage.from("property-photos").getPublicUrl(photoRow.path).data.publicUrl
    : undefined;

  return {
    title: property.address,
    description,
    openGraph: {
      title: property.address,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { admin, property } = await loadProperty(propertyId);

  if (!property) notFound();

  await admin.rpc("increment_property_view_count", { p_id: propertyId });

  const STATUS_LABELS: Record<string, string> = {
    reserved: "Foglalt",
    sold: "Eladva",
    rented: "Kiadva",
  };
  const isUnavailable = property.status === "sold" || property.status === "rented";

  const [{ data: agency }, { data: photoRows }] = await Promise.all([
    admin
      .from("agencies")
      .select("name, logo_path, accent_preset, slug")
      .eq("id", property.agency_id)
      .maybeSingle(),
    admin
      .from("property_photos")
      .select("path")
      .eq("property_id", propertyId)
      .order("position", { ascending: true }),
  ]);

  const photos = (photoRows ?? []).map(
    (p) => admin.storage.from("property-photos").getPublicUrl(p.path).data.publicUrl,
  );
  const notes = (property.features as { notes?: string } | null)?.notes;
  const preset = getAccentPreset(agency?.accent_preset);
  const logoUrl = agency?.logo_path
    ? admin.storage.from("agency-logos").getPublicUrl(agency.logo_path).data.publicUrl
    : null;

  return (
    <main
      className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-10 print:py-0"
      style={
        {
          "--accent": preset.accent,
          "--accent-hover": preset.hover,
          "--accent-soft": preset.soft,
        } as CSSProperties
      }
    >
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-7 w-7 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
              <Building2 className="h-4 w-4" strokeWidth={2.25} />
            </div>
          )}
          {agency?.slug ? (
            <Link
              href={`/a/${agency.slug}`}
              className="text-sm font-semibold text-foreground hover:text-accent"
            >
              {agency.name}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-foreground">
              {agency?.name ?? "Ingatlan CRM"}
            </span>
          )}
        </div>
        <PrintButton />
      </div>

      {photos.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className={`rounded-lg object-cover ${i === 0 ? "col-span-2 row-span-2 h-64 sm:col-span-2 sm:h-full" : "h-32"}`}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {property.address}
        </h1>
        {property.status !== "available" && (
          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted">
            {STATUS_LABELS[property.status] ?? property.status}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
        {property.price && (
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4" strokeWidth={1.75} />
            {property.price.toLocaleString("hu-HU")} Ft
          </span>
        )}
        {property.size_sqm && (
          <span className="flex items-center gap-1.5">
            <Ruler className="h-4 w-4" strokeWidth={1.75} />
            {property.size_sqm} m²
          </span>
        )}
      </div>

      {property.ai_description && (
        <p className="mt-6 leading-relaxed text-foreground">
          {property.ai_description}
        </p>
      )}

      {notes && (
        <p className="mt-4 text-sm text-muted">
          <span className="font-medium text-foreground">Jellemzők: </span>
          {notes}
        </p>
      )}

      <div className="mt-10 print:hidden">
        {isUnavailable ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            Ez az ingatlan már nem elérhető, de örömmel segítünk hasonlót találni —
            keresse irodánkat elérhetőségeinken.
          </p>
        ) : (
          <LeadForm agencyId={property.agency_id} propertyId={property.id} />
        )}
      </div>
    </main>
  );
}

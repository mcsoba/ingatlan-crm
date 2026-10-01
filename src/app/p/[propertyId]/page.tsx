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
import {
  CONDITION_LABELS,
  HEATING_LABELS,
  LISTING_TYPE_LABELS,
  PARKING_LABELS,
  PROPERTY_TYPE_LABELS,
  floorLabel,
} from "@/app/dashboard/properties/constants";

const loadProperty = cache(async (propertyId: string) => {
  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select(
      "id, agency_id, address, price, size_sqm, status, ai_description, features, listing_type, property_type, city, postal_code, plot_sqm, rooms, half_rooms, floor, building_floors, year_built, condition, heating, energy_rating, parking, balcony_sqm, has_lift, has_air_conditioning, has_garden_access, is_furnished, monthly_common_cost, min_lease_months, pets_allowed",
    )
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
  const isRent = property.listing_type === "rent";
  const yesNo = (v: boolean | null) => (v === true ? "Igen" : v === false ? "Nem" : null);
  const details: [string, string | number | null | undefined][] = [
    ["Hirdetés", property.listing_type ? LISTING_TYPE_LABELS[property.listing_type] : null],
    ["Típus", property.property_type ? PROPERTY_TYPE_LABELS[property.property_type] : null],
    ["Település", [property.postal_code, property.city].filter(Boolean).join(" ") || null],
    [
      "Szobák",
      property.rooms != null
        ? property.half_rooms
          ? `${property.rooms} + ${property.half_rooms} fél`
          : property.rooms
        : null,
    ],
    ["Telekméret", property.plot_sqm ? `${property.plot_sqm} m²` : null],
    ["Állapot", property.condition ? CONDITION_LABELS[property.condition] : null],
    ["Építés éve", property.year_built],
    ["Emelet", floorLabel(property.floor)],
    ["Épület szintjei", property.building_floors],
    [
      "Fűtés",
      (property.heating ?? []).map((h: string) => HEATING_LABELS[h]).filter(Boolean).join(", ") || null,
    ],
    ["Energetikai besorolás", property.energy_rating],
    ["Parkolás", property.parking ? PARKING_LABELS[property.parking] : null],
    ["Erkély / terasz", property.balcony_sqm ? `${property.balcony_sqm} m²` : null],
    ["Lift", yesNo(property.has_lift)],
    ["Klíma", yesNo(property.has_air_conditioning)],
    ["Kertkapcsolatos", yesNo(property.has_garden_access)],
    ["Bútorozott", yesNo(property.is_furnished)],
    [
      "Közös költség",
      property.monthly_common_cost
        ? `${property.monthly_common_cost.toLocaleString("hu-HU")} Ft/hó`
        : null,
    ],
    ["Min. bérleti idő", isRent && property.min_lease_months ? `${property.min_lease_months} hónap` : null],
    ["Kisállat", isRent ? yesNo(property.pets_allowed) : null],
  ];
  const visibleDetails = details.filter(([, v]) => v != null && v !== "");
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
            {property.price.toLocaleString("hu-HU")} Ft{isRent ? "/hó" : ""}
          </span>
        )}
        {property.size_sqm && (
          <span className="flex items-center gap-1.5">
            <Ruler className="h-4 w-4" strokeWidth={1.75} />
            {property.size_sqm} m²
          </span>
        )}
      </div>

      {visibleDetails.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-3">
          {visibleDetails.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}

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

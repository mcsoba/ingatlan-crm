import { notFound } from "next/navigation";
import { Building2, Ruler, Wallet } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "./print-button";
import { LeadForm } from "./lead-form";

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const admin = createAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select("id, agency_id, address, price, size_sqm, ai_description, features")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property) notFound();

  const [{ data: agency }, { data: photoRows }] = await Promise.all([
    admin.from("agencies").select("name").eq("id", property.agency_id).maybeSingle(),
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

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-10 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <Building2 className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-semibold text-foreground">
            {agency?.name ?? "Ingatlan CRM"}
          </span>
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

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
        {property.address}
      </h1>

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
        <LeadForm agencyId={property.agency_id} propertyId={property.id} />
      </div>
    </main>
  );
}

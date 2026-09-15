import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateProperty } from "../../actions";
import { PropertyForm } from "../../property-form";
import { PropertyGallery } from "../../property-gallery";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { sectionLabelClass } from "@/components/ui/styles";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: property }, { data: photoRows }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, address, price, size_sqm, status, features, ai_description")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("property_photos")
      .select("id, path")
      .eq("property_id", id)
      .order("position", { ascending: true }),
  ]);

  if (!property) notFound();

  const updateWithId = updateProperty.bind(null, property.id);
  const photos = (photoRows ?? []).map((p) => ({
    id: p.id,
    url: supabase.storage.from("property-photos").getPublicUrl(p.path).data
      .publicUrl,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={property.address}
        description="Ingatlan szerkesztése"
        action={
          <div className="flex items-center gap-3">
            <a
              href={`/p/${property.id}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants("secondary", "sm")}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              Nyilvános oldal
            </a>
            <Link
              href="/dashboard/properties"
              className="text-sm text-muted hover:text-accent"
            >
              ← Ingatlanok
            </Link>
          </div>
        }
      />
      <PropertyForm
        action={updateWithId}
        defaultValues={property}
        submitLabel="Mentés"
      />

      {photos.length > 0 && (
        <div className="max-w-md">
          <h2 className={`mb-2 ${sectionLabelClass}`}>
            Galéria ({photos.length} fotó)
          </h2>
          <PropertyGallery propertyId={property.id} photos={photos} />
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { updateProperty } from "../../actions";
import { PropertyForm } from "../../property-form";
import { PropertyGallery } from "../../property-gallery";
import { TagPicker } from "../../../tags/tag-picker";
import { listAgencyTags } from "../../../tags/actions";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { sectionLabelClass } from "@/components/ui/styles";
import { SIMPLE_MODE } from "@/lib/edition";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { listTeamMembers } from "@/lib/team";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: property }, { data: photoRows }, { data: propertyTagRows }, allTags, teamMembers, { profile }] =
    await Promise.all([
      supabase
        .from("properties")
        .select(
          "id, owner_id, address, price, size_sqm, status, features, ai_description, listing_type, property_type, city, postal_code, plot_sqm, rooms, half_rooms, floor, building_floors, year_built, condition, heating, energy_rating, parking, balcony_sqm, has_lift, has_air_conditioning, has_garden_access, is_furnished, monthly_common_cost, min_lease_months, pets_allowed",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("property_photos")
        .select("id, path")
        .eq("property_id", id)
        .order("position", { ascending: true }),
      supabase.from("property_tags").select("tag_id").eq("property_id", id),
      listAgencyTags(),
      listTeamMembers(),
      ensureCurrentUserProfile(),
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

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <PropertyForm
            action={updateWithId}
            defaultValues={property}
            submitLabel="Mentés"
            teamMembers={teamMembers}
            currentUserId={profile.id}
          />
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          {!SIMPLE_MODE && (
          <TagPicker
            entityType="property"
            entityId={property.id}
            allTags={allTags}
            initialTagIds={(propertyTagRows ?? []).map((r) => r.tag_id)}
          />
          )}
          {photos.length > 0 && (
            <div>
              <h2 className={`mb-2 ${sectionLabelClass}`}>
                Galéria ({photos.length} fotó)
              </h2>
              <PropertyGallery propertyId={property.id} photos={photos} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

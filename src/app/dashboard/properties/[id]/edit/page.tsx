import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProperty } from "../../actions";
import { PropertyForm } from "../../property-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, address, price, size_sqm, features, ai_description")
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const updateWithId = updateProperty.bind(null, property.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={property.address}
        description="Ingatlan szerkesztése"
        action={
          <Link
            href="/dashboard/properties"
            className="text-sm text-muted hover:text-accent"
          >
            ← Ingatlanok
          </Link>
        }
      />
      <PropertyForm
        action={updateWithId}
        defaultValues={property}
        submitLabel="Mentés"
      />
    </div>
  );
}

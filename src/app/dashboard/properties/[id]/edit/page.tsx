import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProperty } from "../../actions";
import { PropertyForm } from "../../property-form";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, address, price, size_sqm, features")
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const updateWithId = updateProperty.bind(null, property.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Ingatlan szerkesztése</h1>
      <div className="mt-6">
        <PropertyForm
          action={updateWithId}
          defaultValues={property}
          submitLabel="Mentés"
        />
      </div>
    </div>
  );
}

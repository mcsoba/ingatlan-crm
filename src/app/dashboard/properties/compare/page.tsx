import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ComparePanel } from "./compare-panel";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

export default async function ComparePropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const propertyIds = (ids ?? "").split(",").filter(Boolean).slice(0, 4);

  const supabase = await createClient();
  const { data: properties, error } =
    propertyIds.length > 0
      ? await supabase
          .from("properties")
          .select("id, address, price, size_sqm")
          .in("id", propertyIds)
      : { data: [], error: null };

  if (error) throw error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingatlanok összehasonlítása"
        description="AI-alapú előny/hátrány elemzés a kiválasztott ingatlanokhoz."
        helpText="Az AI a rögzített ár, méret és jellemzők alapján hasonlítja össze a listát — csak a nálunk rögzített adatokból következtet, nem talál ki tényeket."
        action={
          <Link href="/dashboard/properties" className="text-sm text-muted hover:text-accent">
            ← Ingatlanok
          </Link>
        }
      />

      {properties.length < 2 ? (
        <EmptyState
          icon={Building2}
          title="Válassz legalább 2 ingatlant"
          description="Az Ingatlanok listán jelölj ki 2-4 elemet, majd kattints az 'Összehasonlítás' gombra."
        />
      ) : (
        <ComparePanel properties={properties} />
      )}
    </div>
  );
}

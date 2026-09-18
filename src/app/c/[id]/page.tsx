import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Ruler, Wallet, Check, X, Sparkles } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccentPreset } from "@/lib/accent-presets";
import { Card } from "@/components/ui/card";

type Analysis = {
  perProperty: { id: string; pros: string[]; cons: string[] }[];
  recommendation: string;
};

const loadComparison = cache(async (id: string) => {
  const admin = createAdminClient();
  const { data: comparison } = await admin
    .from("property_comparisons")
    .select("id, agency_id, property_ids, analysis, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!comparison) return { admin, comparison: null, agency: null, properties: [] };

  const [{ data: agency }, { data: properties }] = await Promise.all([
    admin
      .from("agencies")
      .select("name, logo_path, accent_preset, slug")
      .eq("id", comparison.agency_id)
      .maybeSingle(),
    admin
      .from("properties")
      .select("id, address, price, size_sqm")
      .in("id", comparison.property_ids as string[])
      .is("deleted_at", null),
  ]);

  return { admin, comparison, agency, properties: properties ?? [] };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { agency, properties } = await loadComparison(id);
  if (!properties.length) return { title: "Összehasonlítás nem található" };

  const title = `Ingatlan-összehasonlítás — ${agency?.name ?? "Ingatlan CRM"}`;
  const description = `${properties.length} kiválasztott ingatlan összevetése.`;

  return { title, description, openGraph: { title, description } };
}

export default async function PublicComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { admin, comparison, agency, properties } = await loadComparison(id);

  if (!comparison || properties.length === 0) notFound();

  const analysis = comparison.analysis as Analysis;
  const preset = getAccentPreset(agency?.accent_preset);
  const logoUrl = agency?.logo_path
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
        {agency?.slug ? (
          <Link
            href={`/a/${agency.slug}`}
            className="text-lg font-semibold text-foreground hover:text-accent"
          >
            {agency.name}
          </Link>
        ) : (
          <h1 className="text-lg font-semibold text-foreground">
            {agency?.name ?? "Ingatlan CRM"}
          </h1>
        )}
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Az Ön számára összeállított ingatlan-összehasonlítás.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => {
          const item = analysis.perProperty.find((p) => p.id === property.id);
          return (
            <Card key={property.id} className="flex flex-col gap-3 p-4">
              <div>
                <Link
                  href={`/p/${property.id}`}
                  className="font-medium text-foreground hover:text-accent"
                >
                  {property.address}
                </Link>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
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
              </div>

              {item && item.pros.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {item.pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-success">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="text-foreground">{pro}</span>
                    </li>
                  ))}
                </ul>
              )}
              {item && item.cons.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {item.cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-danger">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="text-foreground">{con}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {analysis.recommendation && (
        <Card className="mt-6 border-accent/30 bg-accent-soft p-4 text-sm">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-accent-hover">
            <Sparkles className="h-3.5 w-3.5" />
            Javaslat
          </div>
          <p className="text-foreground">{analysis.recommendation}</p>
        </Card>
      )}
    </main>
  );
}

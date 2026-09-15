import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { toCsv } from "@/lib/csv";

export async function GET() {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: properties, error } = await supabase
    .from("properties")
    .select("address, price, size_sqm, status, features, ai_description")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const csv = toCsv(
    ["address", "price", "size_sqm", "status", "notes", "ai_description"],
    (properties ?? []).map((p) => [
      p.address,
      p.price,
      p.size_sqm,
      p.status,
      (p.features as { notes?: string } | null)?.notes ?? "",
      p.ai_description,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ingatlanok.csv"',
    },
  });
}

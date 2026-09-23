import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { toCsv } from "@/lib/csv";

type DealExportRow = {
  status: string;
  deal_type: string;
  deal_amount: number | null;
  commission_rate: number | null;
  lost_reason: string | null;
  created_at: string;
  contacts: { name: string } | null;
  properties: { address: string } | null;
  pipeline_stages: { name: string } | null;
  profiles: { full_name: string | null } | null;
};

export async function GET() {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: deals, error } = await supabase
    .from("deals")
    .select(
      "status, deal_type, deal_amount, commission_rate, lost_reason, created_at, contacts(name), properties(address), pipeline_stages(name), profiles(full_name)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (deals ?? []) as unknown as DealExportRow[];

  const csv = toCsv(
    [
      "contact",
      "property",
      "stage",
      "status",
      "deal_type",
      "owner",
      "deal_amount",
      "commission_rate",
      "commission",
      "lost_reason",
      "created_at",
    ],
    rows.map((deal) => [
      deal.contacts?.name ?? "",
      deal.properties?.address ?? "",
      deal.pipeline_stages?.name ?? "",
      deal.status,
      deal.deal_type,
      deal.profiles?.full_name ?? "",
      deal.deal_amount,
      deal.commission_rate,
      deal.deal_amount != null && deal.commission_rate != null
        ? Math.round((deal.deal_amount * deal.commission_rate) / 100)
        : null,
      deal.lost_reason,
      deal.created_at,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pipeline.csv"',
    },
  });
}

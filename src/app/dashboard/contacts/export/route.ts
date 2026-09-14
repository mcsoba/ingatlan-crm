import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { toCsv } from "@/lib/csv";

export async function GET() {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("name, email, phone, source, status, notes")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const csv = toCsv(
    ["name", "email", "phone", "source", "status", "notes"],
    (contacts ?? []).map((c) => [
      c.name,
      c.email,
      c.phone,
      c.source,
      c.status,
      c.notes,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kontaktok.csv"',
    },
  });
}

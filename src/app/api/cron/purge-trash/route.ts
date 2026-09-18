import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TABLES = ["deals", "contacts", "properties"] as const;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const purged: Record<string, number> = {};

  // Deals first, so a permanently-purged contact/property never leaves a
  // dangling deal behind for the next run to trip over.
  for (const table of TABLES) {
    const { data, error } = await admin
      .from(table)
      .delete()
      .lt("deleted_at", cutoff)
      .not("deleted_at", "is", null)
      .select("id");

    purged[table] = error ? 0 : (data?.length ?? 0);
  }

  return NextResponse.json({ ok: true, purged });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncActivityForConnection } from "@/lib/google-calendar-sync";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: connections, error: connectionsError } = await admin
    .from("google_calendar_connections")
    .select("profile_id, agency_id, access_token, refresh_token, token_expiry");

  if (connectionsError) {
    return NextResponse.json({ error: connectionsError.message }, { status: 500 });
  }

  let synced = 0;
  let skipped = 0;

  for (const connection of connections ?? []) {
    const { data: dueActivities } = await admin
      .from("activities")
      .select("id, type, content, due_at")
      .eq("agency_id", connection.agency_id)
      .eq("done", false)
      .neq("type", "checklist")
      .not("due_at", "is", null)
      .gte("due_at", windowStart.toISOString())
      .lte("due_at", windowEnd.toISOString())
      .limit(50);

    for (const activity of dueActivities ?? []) {
      const { data: existing } = await admin
        .from("activity_google_events")
        .select("activity_id")
        .eq("activity_id", activity.id)
        .eq("profile_id", connection.profile_id)
        .maybeSingle();

      if (existing) continue;

      try {
        await syncActivityForConnection(
          admin,
          activity as { id: string; type: string; content: string; due_at: string },
          connection,
        );
        synced++;
      } catch {
        // Google API-hiba vagy lejárt/visszavont hozzáférés — ezt az
        // aktivitást kihagyjuk ennél a kapcsolatnál, a következő
        // cron-futásnál újra megpróbáljuk (nincs jelölve szinkronizáltnak).
        skipped++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    connections: connections?.length ?? 0,
    synced,
    skipped,
  });
}

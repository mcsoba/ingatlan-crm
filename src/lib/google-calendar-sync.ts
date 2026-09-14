import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken, createCalendarEvent } from "@/lib/google";

type AdminClient = ReturnType<typeof createAdminClient>;

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

async function getValidAccessToken(
  admin: AdminClient,
  connection: { profile_id: string; access_token: string; refresh_token: string; token_expiry: string },
): Promise<string> {
  const expiresInMs = new Date(connection.token_expiry).getTime() - Date.now();
  if (expiresInMs > 60_000) {
    return connection.access_token;
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await admin
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry })
    .eq("profile_id", connection.profile_id);

  return refreshed.access_token;
}

type ActivityToSync = {
  id: string;
  type: string;
  content: string;
  due_at: string;
};

/**
 * Pushes one activity to one connected user's Google Calendar as an
 * all-day event, recording the event id so it isn't pushed twice.
 * Best-effort: throws only on genuine API failure, caller decides
 * whether to count it as skipped.
 */
export async function syncActivityForConnection(
  admin: AdminClient,
  activity: ActivityToSync,
  connection: { profile_id: string; access_token: string; refresh_token: string; token_expiry: string },
): Promise<void> {
  const accessToken = await getValidAccessToken(admin, connection);
  const date = new Date(activity.due_at).toISOString().slice(0, 10);

  const eventId = await createCalendarEvent(accessToken, {
    summary: `[Ingatlan CRM] ${activity.content}`,
    description: `Típus: ${TYPE_LABELS[activity.type] ?? activity.type}`,
    date,
  });

  await admin.from("activity_google_events").insert({
    activity_id: activity.id,
    profile_id: connection.profile_id,
    google_event_id: eventId,
  });
}

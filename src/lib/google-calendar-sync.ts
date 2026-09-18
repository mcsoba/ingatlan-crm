import { createAdminClient } from "@/lib/supabase/admin";
import {
  refreshAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google";

type AdminClient = ReturnType<typeof createAdminClient>;

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

type GoogleConnectionRow = {
  profile_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
};

async function getValidAccessToken(
  admin: AdminClient,
  connection: GoogleConnectionRow,
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
  connection: GoogleConnectionRow,
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

/**
 * CRM -> Google, frissítés irány: ha egy aktivitás kész lesz (vagy
 * visszanyílik), a már korábban pusholt Google-eseményeket (lehet
 * több is, ha több csapattag csatlakoztatta a naptárát) frissíti --
 * a cím elé "[Kész]" jelölést tesz, vagy leveszi róla.
 * Best-effort: minden kapcsolatot külön try/catch-ben kezel, egy
 * sikertelen hívás nem szakítja meg a többit, és sose dob hibát
 * kifelé -- a hívó CRM-művelet ettől függetlenül sikeres marad.
 */
export async function syncActivityStatusChange(
  admin: AdminClient,
  activityId: string,
  done: boolean,
): Promise<void> {
  const { data: links } = await admin
    .from("activity_google_events")
    .select("google_event_id, profile_id")
    .eq("activity_id", activityId);
  if (!links || links.length === 0) return;

  const { data: activity } = await admin
    .from("activities")
    .select("content, type")
    .eq("id", activityId)
    .single();
  if (!activity) return;

  const summary = `[Ingatlan CRM]${done ? " [Kész]" : ""} ${activity.content}`;
  const description = `Típus: ${TYPE_LABELS[activity.type] ?? activity.type}`;

  for (const link of links) {
    try {
      const { data: connection } = await admin
        .from("google_calendar_connections")
        .select("profile_id, access_token, refresh_token, token_expiry")
        .eq("profile_id", link.profile_id)
        .single();
      if (!connection) continue;

      const accessToken = await getValidAccessToken(admin, connection);
      await updateCalendarEvent(accessToken, link.google_event_id, { summary, description });
    } catch (err) {
      console.error("Google Naptár esemény frissítése sikertelen", link.profile_id, err);
    }
  }
}

/**
 * CRM -> Google, törlés irány: egy aktivitás törlésekor a már
 * korábban pusholt Google-eseményeket is törli. Ugyanaz a
 * best-effort/hibatűrő minta, mint a fenti státusz-szinkronnál --
 * ezt a törölendő `activities` sor előtt kell meghívni, mert az
 * `activity_google_events` sorok `on delete cascade`-del automatikusan
 * eltűnnek, amint az aktivitás törlődik.
 */
export async function syncActivityDeletion(
  admin: AdminClient,
  activityId: string,
): Promise<void> {
  const { data: links } = await admin
    .from("activity_google_events")
    .select("google_event_id, profile_id")
    .eq("activity_id", activityId);
  if (!links || links.length === 0) return;

  for (const link of links) {
    try {
      const { data: connection } = await admin
        .from("google_calendar_connections")
        .select("profile_id, access_token, refresh_token, token_expiry")
        .eq("profile_id", link.profile_id)
        .single();
      if (!connection) continue;

      const accessToken = await getValidAccessToken(admin, connection);
      await deleteCalendarEvent(accessToken, link.google_event_id);
    } catch (err) {
      console.error("Google Naptár esemény törlése sikertelen", link.profile_id, err);
    }
  }
}

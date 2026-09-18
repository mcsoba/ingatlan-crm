const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} nincs beállítva — add meg a .env.local-ban a Google Naptár integrációhoz`,
    );
  }
  return value;
}

function redirectUri(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${site}/api/google/callback`;
}

export function getGoogleAuthUrl(state: string): string {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.events",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error("Nem sikerült a Google engedélyezési kódot beváltani");
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Nem sikerült frissíteni a Google-hozzáférést — csatlakoztasd újra a naptárat");
  }
  return res.json();
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
}

export type CalendarEventInput = {
  summary: string;
  description?: string;
  date: string; // YYYY-MM-DD, egész napos esemény (a due_at dátum-only mező)
};

export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEventInput,
): Promise<string> {
  const endDate = new Date(`${event.date}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  const res = await fetch(CALENDAR_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { date: event.date },
      end: { date: endDate.toISOString().slice(0, 10) },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Naptár esemény létrehozása sikertelen: ${text}`);
  }
  const data = await res.json();
  return data.id as string;
}

export type CalendarEventPatch = {
  summary?: string;
  description?: string;
};

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  patch: CalendarEventPatch,
): Promise<void> {
  const res = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Naptár esemény frissítése sikertelen: ${text}`);
  }
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Google 404-et/410-et ad, ha az esemény már törölve lett kézzel a
  // naptárban -- ez nálunk nem hiba, a cél állapot (nincs esemény) elérve.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Google Naptár esemény törlése sikertelen: ${text}`);
  }
}

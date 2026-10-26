import type { SupabaseClient } from "@supabase/supabase-js";

// Push-értesítés a mobilappnak az Expo push-szolgáltatásán keresztül
// (https://docs.expo.dev/push-notifications/sending-notifications/).
// Nincs hozzá kulcs: az Expo push-tokenek önmagukban hitelesítenek.
// Mint az email/SMS-nél: a küldés hibája sosem akaszthatja el a fő műveletet.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

export type PushMessage = {
  title: string;
  body: string;
  // A mobilapp ezt az útvonalat nyitja meg, ha a felhasználó rákoppint
  // (pl. "/contact/<id>", "/deal/<id>", "/").
  url?: string;
};

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

export async function sendPushToProfiles(
  admin: SupabaseClient,
  profileIds: (string | null | undefined)[],
  message: PushMessage,
): Promise<number> {
  const ids = [...new Set(profileIds.filter((id): id is string => !!id))];
  if (!ids.length) return 0;

  try {
    const { data: rows } = await admin.from("push_tokens").select("token").in("profile_id", ids);
    const tokens = (rows ?? []).map((r) => r.token as string);
    if (!tokens.length) return 0;

    let sent = 0;
    const deadTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            sound: "default",
            data: { url: message.url ?? "/" },
          })),
        ),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: ExpoTicket[] };
      (json.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === "ok") sent++;
        // Törölt app / kijelentkezett eszköz: a tokent kitakarítjuk
        else if (ticket.details?.error === "DeviceNotRegistered") deadTokens.push(chunk[idx]!);
      });
    }

    if (deadTokens.length) await admin.from("push_tokens").delete().in("token", deadTokens);
    return sent;
  } catch {
    return 0;
  }
}

// Az iroda összes tagjának (pl. új érdeklődő, ha nincs kinek kiosztani)
export async function sendPushToAgency(
  admin: SupabaseClient,
  agencyId: string,
  message: PushMessage,
): Promise<number> {
  const { data: members } = await admin.from("profiles").select("id").eq("agency_id", agencyId);
  return sendPushToProfiles(
    admin,
    (members ?? []).map((m) => m.id as string),
    message,
  );
}

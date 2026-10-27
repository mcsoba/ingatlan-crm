import { SITE_URL, supabase } from "./supabase";

// Push a kollégának, akire épp rábíztunk valamit (a webes CRM szervere küldi,
// ld. src/app/api/mobile/notify). Hiba esetén csendben kihagyja: az értesítés
// elmaradása nem akaszthatja el a mentést.
export async function notifyAssignee(kind: "task" | "deal" | "contact", id: string): Promise<void> {
  if (!SITE_URL) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${SITE_URL}/api/mobile/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, id }),
    });
  } catch {
    // ld. fent
  }
}

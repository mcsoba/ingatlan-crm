import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfiles } from "@/lib/push";

// A „Felelős munkatárs” mező értéke. undefined, ha az űrlapon nincs ilyen mező
// (pl. régebbi kliens) — ilyenkor a meglévő felelőst nem írjuk felül.
export function readOwnerId(formData: FormData): string | null | undefined {
  if (!formData.has("owner_id")) return undefined;
  return String(formData.get("owner_id") ?? "") || null;
}

// Push-értesítés, ha valaki egy kollégára bízott egy ügyfelet/ingatlant.
export async function notifyNewOwner(
  ownerId: string | null | undefined,
  actor: { id: string; full_name: string | null },
  message: { title: string; body: string; url: string },
) {
  if (!ownerId || ownerId === actor.id) return;
  await sendPushToProfiles(createAdminClient(), [ownerId], message);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { revokeGoogleToken } from "@/lib/google";

export async function updateMyName(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", profile.id);

  if (error) throw error;

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
}

export async function disconnectGoogleCalendar() {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("refresh_token")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("profile_id", profile.id);

  if (error) throw error;

  if (connection?.refresh_token) {
    try {
      await revokeGoogleToken(connection.refresh_token);
    } catch {
      // A helyi kapcsolat törölve, a Google-oldali visszavonás nem
      // kritikus — a felhasználó saját Google-fiókjában is megteheti.
    }
  }

  revalidatePath("/dashboard/settings");
}

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile, requireOwnerOrAdmin } from "@/lib/agency";
import { revokeGoogleToken } from "@/lib/google";
import { ACCENT_PRESET_IDS } from "@/lib/accent-presets";
import { isSafeWebhookUrl } from "@/lib/webhook";

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

export async function updateAgencyBranding(formData: FormData) {
  const profile = await requireOwnerOrAdmin();

  const supabase = await createClient();
  const requestedPreset = String(formData.get("accent_preset") ?? "indigo");
  const updates: { accent_preset: string; logo_path?: string } = {
    accent_preset: ACCENT_PRESET_IDS.includes(requestedPreset) ? requestedPreset : "indigo",
  };

  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const { data: current } = await supabase
      .from("agencies")
      .select("logo_path")
      .eq("id", profile.agency_id)
      .single();

    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.agency_id}/logo-${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("agency-logos")
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;

    if (current?.logo_path) {
      await supabase.storage.from("agency-logos").remove([current.logo_path]);
    }

    updates.logo_path = path;
  }

  const { error } = await supabase.from("agencies").update(updates).eq("id", profile.agency_id);
  if (error) throw error;

  revalidatePath("/dashboard/settings");
}

export async function updateAgencyPublicSlug(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  if (profile.role !== "owner") {
    redirect("/dashboard/settings?error=Csak%20az%20iroda%20tulajdonosa%20m%C3%B3dos%C3%ADthatja%20a%20nyilv%C3%A1nos%20linket");
  }

  const raw = String(formData.get("slug") ?? "").trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

  if (slug.length < 3) {
    redirect(
      `/dashboard/settings?error=${encodeURIComponent("A nyilvános link legalább 3 karakter legyen (kisbetű, szám, kötőjel)")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ slug })
    .eq("id", profile.agency_id);

  if (error) {
    // A duplikátum-link egy várható, gyakori felhasználói hiba (nem
    // programhiba) -- ezért a többi settings-akcióval ellentétben (amik
    // egyszerűen throw-olnak) ez barátságos redirect+banner mintát követ,
    // ugyanúgy mint a Stripe checkout/portal és a Google OAuth route-ok
    // (ld. billing/actions.ts, api/google/callback) -- sima throw esetén
    // élesben a Next.js generikus "Something went wrong" hibaoldala
    // jelenne meg a beviteli mező melletti üzenet helyett.
    const message = error.code === "23505" ? "Ez a link már foglalt, válassz másikat" : error.message;
    redirect(`/dashboard/settings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard/settings");
}

export async function updateAgencyWebhook(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
  const raw = String(formData.get("webhook_url") ?? "").trim();

  if (raw && !isSafeWebhookUrl(raw)) {
    redirect(
      `/dashboard/settings?error=${encodeURIComponent("Érvénytelen webhook URL — csak nyilvános http(s) cím adható meg, belső/localhost cím nem")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({ lead_webhook_url: raw || null })
    .eq("id", profile.agency_id);

  if (error) throw error;

  revalidatePath("/dashboard/settings");
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

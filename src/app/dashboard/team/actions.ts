"use server";

import { revalidatePath } from "next/cache";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireOwner() {
  const { profile } = await ensureCurrentUserProfile();
  if (profile.role !== "owner") {
    throw new Error(
      "Csak az iroda tulajdonosa hívhat meg vagy távolíthat el csapattagokat",
    );
  }
  return profile;
}

export async function inviteTeamMember(formData: FormData) {
  const profile = await requireOwner();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("Az email megadása kötelező");

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });

  if (error) throw error;

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    agency_id: profile.agency_id,
    role: "agent",
  });

  if (profileError) throw profileError;

  revalidatePath("/dashboard/team");
}

export async function removeTeamMember(formData: FormData) {
  const profile = await requireOwner();
  const id = String(formData.get("id"));

  if (id === profile.id) {
    throw new Error("Nem távolíthatod el saját magad");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;

  revalidatePath("/dashboard/team");
}

export async function updateMyPhone(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ phone: phone || null })
    .eq("id", profile.id);

  if (error) throw error;

  revalidatePath("/dashboard/team");
}

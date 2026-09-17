"use server";

import { revalidatePath } from "next/cache";
import { ensureCurrentUserProfile, requireOwner, requireOwnerOrAdmin } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function inviteTeamMember(formData: FormData) {
  const profile = await requireOwnerOrAdmin();
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
  const profile = await requireOwnerOrAdmin();
  const id = String(formData.get("id"));

  if (id === profile.id) {
    throw new Error("Nem távolíthatod el saját magad");
  }

  const admin = createAdminClient();

  // A service-role kliens megkerüli az RLS-t, ezért itt KÉZZEL kell
  // ellenőrizni, hogy a célpont ugyanabba az irodába tartozik-e (különben
  // egy tetszőleges, akár másik irodához tartozó user id-t megadva bárki
  // törölhető lenne) -- és hogy admin hívó csak sima "agent" tagot
  // távolíthat el, owner-t/másik admint nem.
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("agency_id, role")
    .eq("id", id)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target || target.agency_id !== profile.agency_id) {
    throw new Error("Ez a felhasználó nem található az irodádban");
  }
  if (profile.role === "admin" && target.role !== "agent") {
    throw new Error("Admin csak sima csapattagot távolíthat el");
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;

  revalidatePath("/dashboard/team");
}

export async function updateTeamMemberRole(formData: FormData) {
  const profile = await requireOwner();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));

  if (role !== "admin" && role !== "agent") {
    throw new Error("Érvénytelen szerepkör");
  }
  if (id === profile.id) {
    throw new Error("Saját szerepkörödet nem módosíthatod");
  }

  const admin = createAdminClient();

  // Tenant-ellenőrzés (ld. removeTeamMember) + biztosíték, hogy csak
  // admin<->agent között váltunk, owner szerepkör sose módosul innen.
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("agency_id, role")
    .eq("id", id)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target || target.agency_id !== profile.agency_id) {
    throw new Error("Ez a felhasználó nem található az irodádban");
  }
  if (target.role === "owner") {
    throw new Error("A tulajdonos szerepköre nem módosítható");
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
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

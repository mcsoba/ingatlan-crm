import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AgencySummary = {
  name: string;
  plan_tier: string;
};

export type ProfileWithAgency = {
  id: string;
  agency_id: string;
  role: string;
  full_name: string | null;
  agencies: AgencySummary;
};

const PROFILE_SELECT = "id, agency_id, role, full_name, agencies(name, plan_tier)";

/**
 * Loads the signed-in user's profile, creating the agency + owner profile
 * on first login (agency name comes from signup metadata). Redirects to
 * /login if there is no session.
 */
export const ensureCurrentUserProfile = cache(async function ensureCurrentUserProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle<ProfileWithAgency>();

  if (!profile) {
    const agencyName =
      (user.user_metadata?.agency_name as string | undefined)?.trim() ||
      "Új iroda";

    const { error: rpcError } = await supabase.rpc(
      "create_agency_with_owner",
      { agency_name: agencyName },
    );

    if (rpcError) {
      throw rpcError;
    }

    const { data: createdProfile, error: reloadError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", user.id)
      .single<ProfileWithAgency>();

    if (reloadError) {
      throw reloadError;
    }

    profile = createdProfile;
  }

  return { user, profile };
});

/** Throws unless the caller is the agency owner. */
export async function requireOwner() {
  const { profile } = await ensureCurrentUserProfile();
  if (profile.role !== "owner") {
    throw new Error("Ehhez az iroda tulajdonosának jogosultsága szükséges");
  }
  return profile;
}

/** Throws unless the caller is the agency owner or an admin. */
export async function requireOwnerOrAdmin() {
  const { profile } = await ensureCurrentUserProfile();
  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new Error("Ehhez tulajdonosi vagy admin jogosultság szükséges");
  }
  return profile;
}

"use server";

import { revalidatePath } from "next/cache";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";

const REVALIDATE_PATH: Record<string, string> = {
  contacts: "/dashboard/contacts",
  properties: "/dashboard/properties",
  deals: "/dashboard/pipeline",
};

export async function restoreRecord(table: string, id: string) {
  const { profile } = await ensureCurrentUserProfile();
  if (!(table in REVALIDATE_PATH)) {
    throw new Error("Érvénytelen tábla");
  }

  // Admin client, not RLS-scoped: the row is currently hidden by the
  // SELECT policy (deleted_at is not null), and Postgres applies that same
  // policy to a plain UPDATE's row-visibility -- under RLS this silently
  // matches zero rows instead of restoring anything. The explicit
  // agency_id filter below is what keeps this safe now that RLS isn't
  // doing that job (same reasoning as softDeleteContacts/softDeleteProperties
  // and pipeline's deleteDeal).
  const admin = createAdminClient();
  const { error } = await admin
    .from(table)
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("agency_id", profile.agency_id);

  if (error) throw error;

  revalidatePath("/dashboard/trash");
  revalidatePath(REVALIDATE_PATH[table]);
}

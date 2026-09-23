"use server";

import { revalidatePath } from "next/cache";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";

const REVALIDATE_PATH: Record<string, string> = {
  contacts: "/dashboard/contacts",
  properties: "/dashboard/properties",
  deals: "/dashboard/pipeline",
};

export async function restoreRecord(table: string, id: string) {
  await ensureCurrentUserProfile();
  if (!(table in REVALIDATE_PATH)) {
    throw new Error("Érvénytelen tábla");
  }

  // Goes through the restore_soft_deleted RPC (security definer, 0035)
  // rather than a plain client-side UPDATE: the row is currently hidden by
  // the SELECT policy (deleted_at is not null), and Postgres applies that
  // same policy to a plain UPDATE's row-visibility -- under RLS this
  // silently matches zero rows instead of restoring anything. The RPC
  // bypasses that as the function owner while still running inside the
  // caller's own request, keeping auth.uid() correct for the audit_log
  // trigger -- unlike the admin client this used to go through, which has
  // no user JWT and left every restore attributed to "Rendszer" in
  // Előzmények (same reasoning as softDeleteContacts/softDeleteProperties
  // and pipeline's deleteDeal).
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_soft_deleted", {
    p_table: table,
    p_id: id,
  });

  if (error) throw error;

  revalidatePath("/dashboard/trash");
  revalidatePath(REVALIDATE_PATH[table]);
}

export async function purgeRecord(table: string, id: string) {
  await ensureCurrentUserProfile();
  if (!(table in REVALIDATE_PATH)) {
    throw new Error("Érvénytelen tábla");
  }

  // purge_soft_deleted RPC (security definer, 0036): permanently deletes a
  // record on demand, ahead of the 30-day purge-trash cron. Same RLS-scoped
  // client + security-definer pattern as restoreRecord above, for the same
  // reason (correct auth.uid() attribution in the audit_log trigger) --
  // plus the RPC itself only ever touches rows where deleted_at is already
  // set, so this can't be used to delete a live record.
  const supabase = await createClient();
  const { error } = await supabase.rpc("purge_soft_deleted", {
    p_table: table,
    p_id: id,
  });

  if (error) throw error;

  revalidatePath("/dashboard/trash");
}

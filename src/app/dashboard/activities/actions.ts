"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export async function createActivity(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const content = String(formData.get("content") ?? "").trim();
  if (!content) {
    throw new Error("A tartalom megadása kötelező");
  }

  const contactId = String(formData.get("contact_id") ?? "") || null;
  const dealId = String(formData.get("deal_id") ?? "") || null;
  const type = String(formData.get("type") ?? "note");
  const dueAtRaw = String(formData.get("due_at") ?? "");
  const redirectTo = String(formData.get("redirect_to") ?? "");

  const { error } = await supabase.from("activities").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    deal_id: dealId,
    type,
    content,
    due_at: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
  });

  if (error) throw error;

  if (redirectTo) revalidatePath(redirectTo);
  revalidatePath("/dashboard");
}

export async function toggleActivityDone(
  id: string,
  done: boolean,
  redirectTo: string,
) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("activities")
    .update({ done })
    .eq("id", id);

  if (error) throw error;

  if (redirectTo) revalidatePath(redirectTo);
  revalidatePath("/dashboard");
}

export async function deleteActivity(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));
  const redirectTo = String(formData.get("redirect_to") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;

  if (redirectTo) revalidatePath(redirectTo);
  revalidatePath("/dashboard");
}

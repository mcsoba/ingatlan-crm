"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export type EntityType = "contacts" | "properties";

export type SavedView = {
  id: string;
  name: string;
  filters: Record<string, string>;
};

export async function listSavedViews(entityType: EntityType): Promise<SavedView[]> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saved_views")
    .select("id, name, filters")
    .eq("entity_type", entityType)
    .order("created_at");

  // Swallow rather than throw: the contacts/properties list page renders
  // around this, and until migration 0034_saved_views.sql has actually been
  // run, the table doesn't exist yet — that should degrade to "no saved
  // views" (the create/delete actions below still throw normally, since
  // those are explicit user actions that need real feedback).
  if (error) {
    console.error("listSavedViews failed (has 0034_saved_views.sql been run?)", error);
    return [];
  }

  return (data ?? []) as SavedView[];
}

export async function createSavedView(
  entityType: EntityType,
  name: string,
  filters: Record<string, string>,
) {
  const { profile, user } = await ensureCurrentUserProfile();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A nézet nevének megadása kötelező");

  const supabase = await createClient();
  const { error } = await supabase.from("saved_views").insert({
    agency_id: profile.agency_id,
    created_by: user.id,
    entity_type: entityType,
    name: trimmed,
    filters,
  });
  if (error) throw error;

  revalidatePath(`/dashboard/${entityType}`);
}

export async function deleteSavedView(id: string, entityType: EntityType) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) throw error;

  revalidatePath(`/dashboard/${entityType}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export type TagRow = { id: string; name: string; color: string };

export async function listAgencyTags(): Promise<TagRow[]> {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("agency_id", profile.agency_id)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createTag(name: string, color: string): Promise<TagRow> {
  const { profile } = await ensureCurrentUserProfile();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A címke neve nem lehet üres");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("agency_id", profile.agency_id)
    .eq("name", trimmed)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("tags")
    .insert({ agency_id: profile.agency_id, name: trimmed, color })
    .select("id, name, color")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTag(tagId: string) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw error;
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/properties");
}

export async function setContactTag(
  contactId: string,
  tagId: string,
  assign: boolean,
) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  if (assign) {
    const { error } = await supabase
      .from("contact_tags")
      .insert({ contact_id: contactId, tag_id: tagId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", contactId)
      .eq("tag_id", tagId);
    if (error) throw error;
  }

  revalidatePath(`/dashboard/contacts/${contactId}/edit`);
  revalidatePath("/dashboard/contacts");
}

export async function setPropertyTag(
  propertyId: string,
  tagId: string,
  assign: boolean,
) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  if (assign) {
    const { error } = await supabase
      .from("property_tags")
      .insert({ property_id: propertyId, tag_id: tagId });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("property_tags")
      .delete()
      .eq("property_id", propertyId)
      .eq("tag_id", tagId);
    if (error) throw error;
  }

  revalidatePath(`/dashboard/properties/${propertyId}/edit`);
  revalidatePath("/dashboard/properties");
}

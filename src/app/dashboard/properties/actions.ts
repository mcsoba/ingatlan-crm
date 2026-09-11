"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function uploadPhotoIfPresent(
  supabase: SupabaseClient,
  agencyId: string,
  propertyId: string,
  formData: FormData,
): Promise<string | null> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${agencyId}/${propertyId}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("property-photos")
    .upload(path, file, { contentType: file.type });

  if (error) throw error;

  return path;
}

export async function createProperty(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const address = String(formData.get("address") ?? "").trim();
  if (!address) {
    throw new Error("A cím megadása kötelező");
  }

  const notes = String(formData.get("notes") ?? "").trim();

  const { data: property, error } = await supabase
    .from("properties")
    .insert({
      agency_id: profile.agency_id,
      address,
      price: parseNumber(formData.get("price")),
      size_sqm: parseNumber(formData.get("size_sqm")),
      features: notes ? { notes } : {},
    })
    .select("id")
    .single();

  if (error) throw error;

  const photoPath = await uploadPhotoIfPresent(
    supabase,
    profile.agency_id,
    property.id,
    formData,
  );

  if (photoPath) {
    const { error: photoError } = await supabase
      .from("properties")
      .update({ photo_path: photoPath })
      .eq("id", property.id);
    if (photoError) throw photoError;
  }

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties");
}

export async function updateProperty(id: string, formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const address = String(formData.get("address") ?? "").trim();
  if (!address) {
    throw new Error("A cím megadása kötelező");
  }

  const notes = String(formData.get("notes") ?? "").trim();

  const { error } = await supabase
    .from("properties")
    .update({
      address,
      price: parseNumber(formData.get("price")),
      size_sqm: parseNumber(formData.get("size_sqm")),
      features: notes ? { notes } : {},
    })
    .eq("id", id);

  if (error) throw error;

  const photoPath = await uploadPhotoIfPresent(
    supabase,
    profile.agency_id,
    id,
    formData,
  );

  if (photoPath) {
    const { error: photoError } = await supabase
      .from("properties")
      .update({ photo_path: photoPath })
      .eq("id", id);
    if (photoError) throw photoError;
  }

  revalidatePath("/dashboard/properties");
  redirect("/dashboard/properties");
}

export async function deleteProperty(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/properties");
}

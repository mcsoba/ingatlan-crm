"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

type ContactInput = {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  notes: string;
};

function readContactInput(formData: FormData): ContactInput {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    source: String(formData.get("source") ?? "other"),
    status: String(formData.get("status") ?? "new"),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function createContact(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const input = readContactInput(formData);

  if (!input.name) {
    throw new Error("A név megadása kötelező");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    agency_id: profile.agency_id,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    source: input.source,
    status: input.status,
    notes: input.notes || null,
  });

  if (error) throw error;

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}

export async function updateContact(id: string, formData: FormData) {
  await ensureCurrentUserProfile();
  const input = readContactInput(formData);

  if (!input.name) {
    throw new Error("A név megadása kötelező");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      source: input.source,
      status: input.status,
      notes: input.notes || null,
    })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}

export async function deleteContact(formData: FormData) {
  await ensureCurrentUserProfile();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/contacts");
}

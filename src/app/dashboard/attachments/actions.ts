"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function pathsToRevalidate(contactId: string | null, dealId: string | null): void {
  if (contactId) revalidatePath(`/dashboard/contacts/${contactId}/edit`);
  if (dealId) revalidatePath(`/dashboard/pipeline/${dealId}`);
}

export async function uploadAttachment(formData: FormData) {
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const file = formData.get("file");
  const contactIdRaw = formData.get("contactId");
  const dealIdRaw = formData.get("dealId");
  const contactId = typeof contactIdRaw === "string" && contactIdRaw ? contactIdRaw : null;
  const dealId = typeof dealIdRaw === "string" && dealIdRaw ? dealIdRaw : null;

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Válassz ki egy fájlt");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("A fájl túl nagy (max 15 MB)");
  }
  const entityId = contactId ?? dealId;
  if (!entityId) {
    throw new Error("Hiányzó kontakt vagy deal azonosító");
  }

  const path = `${profile.agency_id}/${entityId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type || undefined });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("attachments").insert({
    agency_id: profile.agency_id,
    contact_id: contactId,
    deal_id: dealId,
    path,
    filename: file.name,
    size_bytes: file.size,
    content_type: file.type || null,
  });

  if (insertError) throw insertError;

  pathsToRevalidate(contactId, dealId);
}

export async function deleteAttachment(formData: FormData) {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const path = String(formData.get("path"));
  const contactIdRaw = formData.get("contactId");
  const dealIdRaw = formData.get("dealId");
  const contactId = typeof contactIdRaw === "string" && contactIdRaw ? contactIdRaw : null;
  const dealId = typeof dealIdRaw === "string" && dealIdRaw ? dealIdRaw : null;

  await supabase.storage.from("attachments").remove([path]);

  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw error;

  pathsToRevalidate(contactId, dealId);
}

export async function getAttachmentDownloadUrl(path: string): Promise<string> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
  if (error || !data) {
    throw new Error("Nem sikerült létrehozni a letöltési linket");
  }
  return data.signedUrl;
}

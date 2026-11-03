"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function pathsToRevalidate(contactId: string | null, dealId: string | null): void {
  if (contactId) revalidatePath(`/dashboard/contacts/${contactId}/edit`);
  if (dealId) revalidatePath(`/dashboard/pipeline/${dealId}`);
}

/**
 * A böngésző a fájlt közvetlenül a tárhelyre tölti (upload-form.tsx), ez csak
 * a bejegyzést rögzíti — a régi szerveres feltöltés ~1 MB fölött elhasalt.
 */
export async function recordAttachment(input: {
  contactId: string | null;
  dealId: string | null;
  path: string;
  filename: string;
  size: number;
  contentType: string | null;
}) {
  const { profile } = await ensureCurrentUserProfile();
  const entityId = input.contactId ?? input.dealId;
  if (!entityId) throw new Error("Hiányzó kontakt vagy üzlet azonosító");
  // Csak a saját iroda / kontakt vagy üzlet mappájába feltöltött fájl rögzíthető
  if (!input.path.startsWith(`${profile.agency_id}/${entityId}/`)) throw new Error("Érvénytelen fájlútvonal");
  if (input.size > MAX_SIZE_BYTES) throw new Error("A fájl túl nagy (max 15 MB)");

  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    agency_id: profile.agency_id,
    contact_id: input.contactId,
    deal_id: input.dealId,
    path: input.path,
    filename: input.filename.slice(0, 200),
    size_bytes: input.size,
    content_type: input.contentType,
  });
  if (error) {
    await supabase.storage.from("attachments").remove([input.path]);
    throw error;
  }
  pathsToRevalidate(input.contactId, input.dealId);
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

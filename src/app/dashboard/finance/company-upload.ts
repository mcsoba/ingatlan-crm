"use client";

import { createClient } from "@/lib/supabase/client";
import { recordCompanyFile } from "./company-actions";
import { shrinkImage } from "./receipt-upload";

const BUCKET = "finance-receipts";
const MAX_BYTES = 15 * 1024 * 1024;

/** Cégdokumentum / fotó feltöltése a privát tárhelyre (<iroda>/companies/<cég>/...). */
export async function uploadCompanyFile(agencyId: string, companyId: string, original: File) {
  const file = await shrinkImage(original);
  if (file.size > MAX_BYTES) throw new Error("A fájl túl nagy (max 15 MB)");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "dokumentum";
  const path = `${agencyId}/companies/${companyId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error("Nem sikerült feltölteni a fájlt");
  await recordCompanyFile({ companyId, path, filename: file.name, size: file.size, contentType: file.type || null });
}

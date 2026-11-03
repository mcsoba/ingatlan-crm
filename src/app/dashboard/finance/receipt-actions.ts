"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerOrAdmin } from "@/lib/agency";

// "use server" fájlból csak async függvény exportálható
const RECEIPT_BUCKET = "finance-receipts";

/**
 * A böngésző a fájlt közvetlenül a tárhelyre tölti fel (a szerverműveletek
 * ~1 MB-os kéréskorlátja miatt), utána ezzel rögzítjük a tételhez.
 */
export async function recordReceipt(input: {
  invoiceId: string;
  path: string;
  filename: string;
  size: number;
  contentType: string | null;
}) {
  const profile = await requireOwnerOrAdmin();
  // Csak a saját iroda / tétel mappájába feltöltött fájl rögzíthető
  if (!input.path.startsWith(`${profile.agency_id}/${input.invoiceId}/`)) {
    throw new Error("Érvénytelen fájlútvonal");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("finance_receipts").insert({
    agency_id: profile.agency_id,
    invoice_id: input.invoiceId,
    path: input.path,
    filename: input.filename.slice(0, 200),
    size_bytes: input.size,
    content_type: input.contentType,
  });
  if (error) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([input.path]);
    throw error;
  }
  revalidatePath("/dashboard/finance", "layout");
}

export async function deleteReceipt(id: string) {
  await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("finance_receipts").select("path").eq("id", id).maybeSingle();
  if (!data) return;
  await supabase.storage.from(RECEIPT_BUCKET).remove([data.path]);
  const { error } = await supabase.from("finance_receipts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/finance", "layout");
}

export async function getReceiptUrl(id: string): Promise<string> {
  await requireOwnerOrAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("finance_receipts").select("path").eq("id", id).maybeSingle();
  if (!row) throw new Error("A fájl nem található");
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(row.path, 120);
  if (error || !data) throw new Error("Nem sikerült megnyitni a fájlt");
  return data.signedUrl;
}

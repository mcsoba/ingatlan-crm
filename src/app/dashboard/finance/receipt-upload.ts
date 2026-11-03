"use client";

import { createClient } from "@/lib/supabase/client";
import { recordReceipt } from "./receipt-actions";

const BUCKET = "finance-receipts";
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2000;

/**
 * Telefonos fotó lekicsinyítése (hosszabbik oldal max. 2000 px, JPEG) — egy
 * blokk így is jól olvasható, de 3–5 MB helyett pár száz KB. PDF-et és a
 * böngésző által nem dekódolható képet (pl. HEIC asztali Chrome-ban) változatlanul töltjük fel.
 */
async function shrinkImage(file: File): Promise<File> {
  // Egyes böngészők / fájlkezelők üres típust adnak — ilyenkor a kiterjesztés dönt
  const isImage = file.type ? file.type.startsWith("image/") : /\.(jpe?g|png|bmp|webp|heic|heif)$/i.test(file.name);
  if (!isImage || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Feltöltés a privát tárhelyre és rögzítés a tételhez. */
export async function uploadReceipt(agencyId: string, invoiceId: string, original: File) {
  const file = await shrinkImage(original);
  if (file.size > MAX_BYTES) throw new Error("A fájl túl nagy (max 15 MB)");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "blokk";
  const path = `${agencyId}/${invoiceId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error("Nem sikerült feltölteni a fájlt");
  await recordReceipt({ invoiceId, path, filename: file.name, size: file.size, contentType: file.type || null });
}

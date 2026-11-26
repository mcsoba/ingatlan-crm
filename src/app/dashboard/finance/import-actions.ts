"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrAdmin } from "@/lib/agency";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ideiglenes Excel-feltöltés: a fájl a privát „finance-imports” tárolóba kerül
 * (nincs nyilvános link), onnan dolgozzuk be az adatokat, utána törölhető.
 * A tárolóhoz csak a szerver fér hozzá (service role) — a jogosultságot itt ellenőrizzük.
 */
const BUCKET = "finance-imports";
const ALLOWED = /.(xlsx|xlsm|xls|csv|txt|pdf|sta|mt940|xml)$/i;

export async function createImportUpload(filename: string) {
  const profile = await requireOwnerOrAdmin();
  if (!ALLOWED.test(filename)) throw new Error("Csak Excel, CSV, PDF vagy banki export (TXT, MT940, XML) tölthető fel");
  // A tároló csak ASCII kulcsot fogad el („Invalid key”): ékezetek levéve, minden más „_”
  const safe =
    filename
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9.\-]+/g, "_")
      .slice(-100) || "import.xlsx";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = `${profile.agency_id}/${stamp}_${safe}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Nem sikerült előkészíteni a feltöltést");
  return { path: data.path, token: data.token };
}

export type ImportFile = { path: string; name: string; size: number; uploadedAt: string };

export async function listImports(): Promise<ImportFile[]> {
  const profile = await requireOwnerOrAdmin();
  const { data } = await createAdminClient()
    .storage.from(BUCKET)
    .list(profile.agency_id, { sortBy: { column: "created_at", order: "desc" } });
  return (data ?? [])
    .filter((f) => f.id)
    .map((f) => ({
      path: `${profile.agency_id}/${f.name}`,
      name: f.name.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/, ""),
      size: Number(f.metadata?.size ?? 0),
      uploadedAt: f.created_at ?? "",
    }));
}

export async function deleteImport(path: string) {
  const profile = await requireOwnerOrAdmin();
  if (!path.startsWith(`${profile.agency_id}/`)) throw new Error("Érvénytelen fájl");
  await createAdminClient().storage.from(BUCKET).remove([path]);
  revalidatePath("/dashboard/finance/import");
}

export async function refreshImports() {
  await requireOwnerOrAdmin();
  revalidatePath("/dashboard/finance/import");
}

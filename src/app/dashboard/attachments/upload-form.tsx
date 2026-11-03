"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordAttachment } from "./actions";

const MAX_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * A fájl a böngészőből közvetlenül a privát tárhelyre megy (a szerverműveletek
 * ~1 MB-os kéréskorlátja miatt — egy telefonos fotó vagy beszkennelt szerződés
 * ennél nagyobb), a szerver csak a bejegyzést rögzíti.
 */
export function AttachmentUploadForm({
  agencyId,
  contactId,
  dealId,
}: {
  agencyId: string;
  contactId?: string;
  dealId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE_BYTES) throw new Error(`${file.name}: a fájl túl nagy (max 15 MB)`);
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-100) || "fajl";
        const path = `${agencyId}/${contactId ?? dealId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(path, file, { contentType: file.type || undefined });
        if (uploadError) throw new Error(`${file.name}: nem sikerült feltölteni`);
        await recordAttachment({
          contactId: contactId ?? null,
          dealId: dealId ?? null,
          path,
          filename: file.name,
          size: file.size,
          contentType: file.type || null,
        });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nem sikerült feltölteni");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1 pt-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? "Feltöltés…" : "Fájl feltöltése"}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

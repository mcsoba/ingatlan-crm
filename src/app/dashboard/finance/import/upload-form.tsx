"use client";

import { useRef, useState, useTransition } from "react";
import { FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createImportUpload, deleteImport, refreshImports, type ImportFile } from "../import-actions";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 30 * 1024 * 1024;

export function ImportUploader({ files }: { files: ImportFile[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const supabase = createClient();
        for (const file of Array.from(list)) {
          if (file.size > MAX_BYTES) throw new Error(`${file.name}: túl nagy (max 30 MB)`);
          const { path, token } = await createImportUpload(file.name);
          const { error } = await supabase.storage.from("finance-imports").uploadToSignedUrl(path, token, file);
          if (error) throw new Error(`${file.name}: ${error.message}`);
        }
        await refreshImports();
        setMessage({ ok: true, text: "Feltöltve. Szólj Claude-nak, hogy feldolgozhatja." });
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Nem sikerült a feltöltés" });
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center"
      >
        <FileSpreadsheet className="h-8 w-8 text-muted" />
        <p className="text-sm text-muted">Húzd ide a fájlt, vagy válaszd ki a gépedről — Excel, CSV, PDF vagy banki export (TXT, MT940, XML), max 30 MB.</p>
        <input
          ref={input}
          type="file"
          multiple
          accept=".xlsx,.xlsm,.xls,.csv,.txt,.pdf,.sta,.mt940,.xml"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button disabled={isPending} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" />
          {isPending ? "Feltöltés…" : "Fájl feltöltése"}
        </Button>
        {message && <span className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</span>}
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border">
          {files.map((f) => (
            <li key={f.path} className="flex items-center gap-3 px-4 py-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-success" />
              <span className="flex-1 truncate font-medium">{f.name}</span>
              <span className="text-xs text-muted tabular-nums">
                {(f.size / 1024).toFixed(0)} KB · {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString("hu-HU") : ""}
              </span>
              <button
                type="button"
                title="Fájl törlése"
                disabled={isPending}
                onClick={() => startTransition(() => deleteImport(f.path))}
                className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

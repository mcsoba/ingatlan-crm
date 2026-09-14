"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { importContactsCsv } from "./actions";
import { Button } from "@/components/ui/button";

export function ImportContactsButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, startImporting] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    startImporting(async () => {
      try {
        const result = await importContactsCsv(formData);
        setMessage(
          `${result.imported} kontakt importálva` +
            (result.skipped > 0 ? `, ${result.skipped} kihagyva` : ""),
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        onClick={() => fileRef.current?.click()}
        disabled={isImporting}
      >
        {isImporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" strokeWidth={1.75} />
        )}
        Importálás CSV-ből
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        className="hidden"
      />
      {message && <span className="text-xs text-success">{message}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

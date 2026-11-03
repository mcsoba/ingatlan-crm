"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { deleteReceipt, getReceiptUrl } from "./receipt-actions";
import { uploadReceipt } from "./receipt-upload";

export type Receipt = { id: string; filename: string; content_type: string | null };

/** Blokk / számla fotója vagy PDF-je egy tételhez (telefonon közvetlenül fényképezhető). */
export function ReceiptsPanel({ agencyId, invoiceId, receipts }: { agencyId: string; invoiceId: string; receipts: Receipt[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) await uploadReceipt(agencyId, invoiceId, f);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nem sikerült feltölteni");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function open(id: string) {
    // Az ablakot szinkron nyitjuk meg, különben a böngésző felugró ablakként blokkolhatja
    const win = window.open("", "_blank");
    try {
      const url = await getReceiptUrl(id);
      if (win) win.location.replace(url);
      else window.location.assign(url);
    } catch (e) {
      win?.close();
      setError(e instanceof Error ? e.message : "Nem sikerült megnyitni");
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Blokk / számla ({receipts.length})</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {busy ? "Feltöltés…" : "Fotó vagy PDF hozzáadása"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {receipts.length === 0 ? (
        <p className="text-xs text-muted">Még nincs csatolva. Telefonon a gomb a kamerát is felajánlja.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {receipts.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted" />
              <button type="button" onClick={() => open(r.id)} className="min-w-0 flex-1 truncate text-left text-accent hover:underline">
                {r.filename}
              </button>
              {confirmId === r.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(async () => {
                      await deleteReceipt(r.id);
                      setConfirmId(null);
                      router.refresh();
                    })}
                    className="font-medium text-danger"
                  >
                    Törlöm
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)} className="text-muted">
                    Mégse
                  </button>
                </span>
              ) : (
                <button type="button" title="Törlés" onClick={() => setConfirmId(r.id)} className="text-muted hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

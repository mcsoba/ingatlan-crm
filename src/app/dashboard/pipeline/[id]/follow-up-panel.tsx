"use client";

import { useState, useTransition } from "react";
import { generateDealFollowUp } from "../actions";

export function DealFollowUpPanel({
  contactName,
  stageName,
  propertyAddress,
  notes,
}: {
  contactName: string;
  stageName: string;
  propertyAddress: string | null;
  notes: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, startGenerating] = useTransition();

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startGenerating(async () => {
      try {
        const result = await generateDealFollowUp({
          contactName,
          stageName,
          propertyAddress,
          notes,
        });
        setDraft(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setError("A vágólapra másolás nem sikerült, jelöld ki kézzel");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-600">Follow-up email vázlat</span>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "Generálás…" : "AI vázlat generálása"}
        </button>
      </div>
      <textarea
        rows={8}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setCopied(false);
        }}
        placeholder="Kattints az „AI vázlat generálása” gombra."
        className="rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
      />
      {draft && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            Másolás vágólapra
          </button>
          {copied && <span className="text-xs text-neutral-500">Másolva!</span>}
        </div>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { generateDealFollowUp } from "../actions";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/styles";

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={labelClass}>Follow-up email vázlat</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          )}
          AI vázlat generálása
        </Button>
      </div>
      <textarea
        rows={8}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setCopied(false);
        }}
        placeholder="Kattints az „AI vázlat generálása” gombra."
        className={`${inputClass} font-mono text-xs`}
      />
      {draft && (
        <Button variant="secondary" size="sm" onClick={handleCopy} className="self-start">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Másolva" : "Másolás vágólapra"}
        </Button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

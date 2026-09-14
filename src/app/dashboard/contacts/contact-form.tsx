"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { generateFollowUpEmail } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

type ContactFormProps = {
  action: (formData: FormData) => void;
  defaultValues?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    source?: string;
    status?: string;
    notes?: string | null;
  };
  submitLabel: string;
};

export function ContactForm({
  action,
  defaultValues,
  submitLabel,
}: ContactFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [source, setSource] = useState(defaultValues?.source ?? "other");
  const [status, setStatus] = useState(defaultValues?.status ?? "new");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");

  const [followUp, setFollowUp] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, startGenerating] = useTransition();

  function handleGenerate() {
    setFollowUpError(null);
    setCopied(false);
    startGenerating(async () => {
      try {
        const draft = await generateFollowUpEmail({ name, status, source, notes });
        setFollowUp(draft);
      } catch (err) {
        setFollowUpError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(followUp);
      setCopied(true);
    } catch {
      setFollowUpError("A vágólapra másolás nem sikerült, jelöld ki kézzel");
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Card className="p-5">
        <form action={action} className="flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Név</span>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Email</span>
            <input
              type="email"
              name="email"
              defaultValue={defaultValues?.email ?? ""}
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Telefon</span>
            <input
              name="phone"
              defaultValue={defaultValues?.phone ?? ""}
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Forrás</span>
            <select
              name="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={inputClass}
            >
              <option value="website">Weboldal</option>
              <option value="referral">Ajánlás</option>
              <option value="phone">Telefon</option>
              <option value="walk_in">Betérő</option>
              <option value="other">Egyéb</option>
            </select>
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Státusz</span>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="new">Új</option>
              <option value="contacted">Felvéve a kapcsolat</option>
              <option value="qualified">Minősített</option>
              <option value="inactive">Inaktív</option>
            </select>
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Jegyzet</span>
            <textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          <Button type="submit" className="mt-1">
            {submitLabel}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <span className={labelClass}>Follow-up email vázlat</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating || !name.trim()}
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
          value={followUp}
          onChange={(e) => {
            setFollowUp(e.target.value);
            setCopied(false);
          }}
          placeholder="Kattints az „AI vázlat generálása” gombra, a kontakt neve, státusza és jegyzete alapján ír egy follow-up emailt."
          className={`${inputClass} font-mono text-xs`}
        />
        {followUp && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Másolva" : "Másolás vágólapra"}
            </Button>
          </div>
        )}
        {followUpError && (
          <span className="text-xs text-danger">{followUpError}</span>
        )}
      </Card>
    </div>
  );
}

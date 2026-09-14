"use client";

import { useState, useTransition } from "react";
import { generateFollowUpEmail } from "./actions";

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
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Név</span>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Email</span>
          <input
            type="email"
            name="email"
            defaultValue={defaultValues?.email ?? ""}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Telefon</span>
          <input
            name="phone"
            defaultValue={defaultValues?.phone ?? ""}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Forrás</span>
          <select
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="website">Weboldal</option>
            <option value="referral">Ajánlás</option>
            <option value="phone">Telefon</option>
            <option value="walk_in">Betérő</option>
            <option value="other">Egyéb</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Státusz</span>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="new">Új</option>
            <option value="contacted">Felvéve a kapcsolat</option>
            <option value="qualified">Minősített</option>
            <option value="inactive">Inaktív</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Jegyzet</span>
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          {submitLabel}
        </button>
      </form>

      <div className="flex flex-col gap-1 border-t border-neutral-200 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">Follow-up email vázlat</span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !name.trim()}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Generálás…" : "AI vázlat generálása"}
          </button>
        </div>
        <textarea
          rows={8}
          value={followUp}
          onChange={(e) => {
            setFollowUp(e.target.value);
            setCopied(false);
          }}
          placeholder="Kattints az „AI vázlat generálása” gombra, a kontakt neve, státusza és jegyzete alapján ír egy follow-up emailt."
          className="rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
        />
        {followUp && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Másolás vágólapra
            </button>
            {copied && (
              <span className="text-xs text-neutral-500">Másolva!</span>
            )}
          </div>
        )}
        {followUpError && (
          <span className="text-xs text-red-600">{followUpError}</span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { generateDescription } from "./actions";

type PropertyFormProps = {
  action: (formData: FormData) => void;
  defaultValues?: {
    address?: string;
    price?: number | null;
    size_sqm?: number | null;
    features?: { notes?: string } | null;
    ai_description?: string | null;
  };
  submitLabel: string;
};

export function PropertyForm({
  action,
  defaultValues,
  submitLabel,
}: PropertyFormProps) {
  const [address, setAddress] = useState(defaultValues?.address ?? "");
  const [price, setPrice] = useState(
    defaultValues?.price != null ? String(defaultValues.price) : "",
  );
  const [sizeSqm, setSizeSqm] = useState(
    defaultValues?.size_sqm != null ? String(defaultValues.size_sqm) : "",
  );
  const [notes, setNotes] = useState(defaultValues?.features?.notes ?? "");
  const [aiDescription, setAiDescription] = useState(
    defaultValues?.ai_description ?? "",
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  function handleGenerate() {
    setAiError(null);
    startGenerating(async () => {
      try {
        const description = await generateDescription({
          address,
          price: price ? Number(price.replace(",", ".")) : null,
          size_sqm: sizeSqm ? Number(sizeSqm.replace(",", ".")) : null,
          notes,
        });
        setAiDescription(description);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Cím</span>
        <input
          name="address"
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Ár (Ft)</span>
        <input
          name="price"
          type="number"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Alapterület (m²)</span>
        <input
          name="size_sqm"
          type="number"
          step="1"
          value={sizeSqm}
          onChange={(e) => setSizeSqm(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Jellemzők / jegyzet</span>
        <textarea
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Fotó</span>
        <input
          name="photo"
          type="file"
          accept="image/*"
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">Hirdetési leírás</span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !address.trim()}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Generálás…" : "AI leírás generálása"}
          </button>
        </div>
        <textarea
          name="ai_description"
          rows={5}
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          placeholder="Kattints az „AI leírás generálása” gombra, vagy írd meg kézzel."
          className="rounded border border-neutral-300 px-3 py-2"
        />
        {aiError && <span className="text-xs text-red-600">{aiError}</span>}
      </div>

      <button
        type="submit"
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}

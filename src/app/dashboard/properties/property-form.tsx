"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateDescription } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

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
    <Card className="max-w-md p-5">
      <form action={action} className="flex flex-col gap-4">
        <div className={fieldGroupClass}>
          <span className={labelClass}>Cím</span>
          <input
            name="address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldGroupClass}>
          <span className={labelClass}>Ár (Ft)</span>
          <input
            name="price"
            type="number"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldGroupClass}>
          <span className={labelClass}>Alapterület (m²)</span>
          <input
            name="size_sqm"
            type="number"
            step="1"
            value={sizeSqm}
            onChange={(e) => setSizeSqm(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldGroupClass}>
          <span className={labelClass}>Jellemzők / jegyzet</span>
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldGroupClass}>
          <span className={labelClass}>Fotó hozzáadása</span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-2.5 file:py-1 file:text-xs file:font-medium`}
          />
        </div>

        <div className={fieldGroupClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>Hirdetési leírás</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !address.trim()}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              )}
              AI leírás generálása
            </Button>
          </div>
          <textarea
            name="ai_description"
            rows={5}
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder="Kattints az „AI leírás generálása” gombra, vagy írd meg kézzel."
            className={inputClass}
          />
          {aiError && <span className="text-xs text-danger">{aiError}</span>}
        </div>

        <Button type="submit" className="mt-1">
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
}

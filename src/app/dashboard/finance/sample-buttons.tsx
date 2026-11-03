"use client";

import { useState, useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { deleteSampleData, loadSampleData } from "./sample-actions";
import { Button } from "@/components/ui/button";

export function LoadSampleButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              await loadSampleData();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Nem sikerült betölteni");
            }
          })
        }
      >
        <FlaskConical className="h-4 w-4" />
        {isPending ? "Betöltés…" : "Mintaadatok betöltése a kipróbáláshoz"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function SampleDataBanner({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
      <FlaskConical className="h-4 w-4 shrink-0 text-accent" />
      <span className="flex-1 text-foreground">
        <strong>Mintaadatok vannak betöltve</strong> ({count} tétel, „Minta …” nevű partnerekkel). Nyugodtan kattintgass,
        pipálj, szerkessz rajtuk — ha végeztél, egy kattintással törölheted őket. A valódi adatokhoz nem nyúl.
      </span>
      {confirming ? (
        <span className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => deleteSampleData())}
            className="rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Törlés…" : "Igen, töröld a mintákat"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-xs text-muted">
            Mégse
          </button>
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          Mintaadatok törlése
        </Button>
      )}
    </div>
  );
}

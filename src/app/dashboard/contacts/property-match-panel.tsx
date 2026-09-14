"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { suggestMatchingProperties, type PropertyMatch } from "./actions";

export function PropertyMatchPanel({ contactId }: { contactId: string }) {
  const [matches, setMatches] = useState<PropertyMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  function handleGenerate() {
    setError(null);
    startGenerating(async () => {
      try {
        const result = await suggestMatchingProperties(contactId);
        setMatches(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="self-start rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? "Keresés…" : "AI ingatlan-javaslat"}
      </button>

      {matches && matches.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nincs egyértelműen illő ingatlan a jegyzet alapján.
        </p>
      )}

      {matches && matches.length > 0 && (
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <Link
              key={match.id}
              href={`/dashboard/properties/${match.id}/edit`}
              className="rounded border border-neutral-200 p-2 text-sm hover:bg-neutral-50"
            >
              <div className="font-medium">{match.address}</div>
              <div className="text-neutral-500">{match.reason}</div>
            </Link>
          ))}
        </div>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

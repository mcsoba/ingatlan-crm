"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Building2 } from "lucide-react";
import { suggestMatchingProperties, type PropertyMatch } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
      <Button
        variant="secondary"
        size="sm"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="self-start"
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        )}
        AI ingatlan-javaslat
      </Button>

      {matches && matches.length === 0 && (
        <p className="text-sm text-muted">
          Nincs egyértelműen illő ingatlan a jegyzet alapján.
        </p>
      )}

      {matches && matches.length > 0 && (
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <Link key={match.id} href={`/dashboard/properties/${match.id}/edit`}>
              <Card className="flex items-start gap-2.5 p-3 text-sm hover:border-accent/40">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-subtle" />
                <div>
                  <div className="font-medium text-foreground">
                    {match.address}
                  </div>
                  <div className="text-muted">{match.reason}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

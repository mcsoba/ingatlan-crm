"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Gauge } from "lucide-react";
import { scoreContactLead } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function scoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-muted";
}

export function LeadScorePanel({
  contactId,
  initialScore,
  initialReason,
}: {
  contactId: string;
  initialScore: number | null;
  initialReason: string | null;
}) {
  const [score, setScore] = useState(initialScore);
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState<string | null>(null);
  const [isScoring, startScoring] = useTransition();

  function handleScore() {
    setError(null);
    startScoring(async () => {
      try {
        const result = await scoreContactLead(contactId);
        setScore(result.score);
        setReason(result.reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        {score != null ? (
          <span className={`text-lg font-semibold ${scoreColor(score)}`}>
            {score}
          </span>
        ) : (
          <Gauge className="h-5 w-5 text-accent-hover" strokeWidth={1.75} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">
          AI érdeklődő-pontszám
        </div>
        <div className="truncate text-sm text-muted">
          {reason ?? "Még nincs kiszámolva."}
        </div>
        {error && <div className="text-xs text-danger">{error}</div>}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleScore}
        disabled={isScoring}
        className="shrink-0"
      >
        {isScoring ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-accent" />
        )}
        Frissítés
      </Button>
    </Card>
  );
}

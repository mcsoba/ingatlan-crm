"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { compareProperties, type PropertyComparison } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PropertySummary = {
  id: string;
  address: string;
  price: number | null;
  size_sqm: number | null;
};

export function ComparePanel({ properties }: { properties: PropertySummary[] }) {
  const [result, setResult] = useState<PropertyComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  function handleGenerate() {
    setError(null);
    startGenerating(async () => {
      try {
        const ids = properties.map((p) => p.id);
        const res = await compareProperties(ids);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  const byId = new Map(properties.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {properties.map((p) => (
          <Card key={p.id} className="p-3 text-sm">
            <div className="font-medium text-foreground">{p.address}</div>
            <div className="mt-1 text-muted">
              {p.price ? `${p.price.toLocaleString("hu-HU")} Ft` : "—"}
              {p.size_sqm ? ` · ${p.size_sqm} m²` : ""}
            </div>
            {p.price && p.size_sqm && (
              <div className="mt-0.5 text-xs text-muted-subtle">
                {Math.round(p.price / p.size_sqm).toLocaleString("hu-HU")} Ft/m²
              </div>
            )}
          </Card>
        ))}
      </div>

      <Button
        variant="secondary"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="self-start"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 text-accent" />
        )}
        AI összehasonlítás generálása
      </Button>

      {error && <span className="text-sm text-danger">{error}</span>}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.perProperty.map((item) => {
              const property = byId.get(item.id);
              if (!property) return null;
              return (
                <Card key={item.id} className="flex flex-col gap-2 p-3 text-sm">
                  <div className="font-medium text-foreground">{property.address}</div>
                  {item.pros.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {item.pros.map((pro, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-success">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          <span className="text-foreground">{pro}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.cons.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {item.cons.map((con, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-danger">
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          <span className="text-foreground">{con}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>

          {result.recommendation && (
            <Card className="border-accent/30 bg-accent-soft p-4 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-accent-hover">
                <Sparkles className="h-3.5 w-3.5" />
                Javaslat
              </div>
              <p className="text-foreground">{result.recommendation}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

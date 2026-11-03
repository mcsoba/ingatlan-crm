"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { markInvoice } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";

/**
 * A Számlázz.hu számlakészítőjébe mezőnként átmásolható adatok (ahogy eddig
 * az Excelből), majd a kapott számlaszám visszaírása — ezzel a tétel
 * kiállítottá válik, és innentől a kifizetését figyeljük.
 */
export function SzamlazzPanel({
  invoiceId,
  fields,
  today,
}: {
  invoiceId: string;
  fields: { label: string; value: string }[];
  today: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // Vágólap nem elérhető (pl. nem biztonságos környezet) — a mező kijelölhető kézzel
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-accent/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Kiállítás a Számlázz.hu-n</h2>
        <a
          href="https://www.szamlazz.hu/szamla/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Számlázz.hu megnyitása
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-xs text-muted">1. Másold át az adatokat mezőnként · 2. Készítsd el a számlát · 3. Írd be ide a kapott számlaszámot.</p>
      <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border">
        {fields
          .filter((f) => f.value)
          .map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => copy(f.label, f.value)}
              className="flex items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-background"
            >
              <span className="w-28 shrink-0 text-xs text-muted">{f.label}</span>
              <span className="min-w-0 flex-1 break-words font-medium text-foreground">{f.value}</span>
              {copied === f.label ? (
                <Check className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Copy className="h-4 w-4 shrink-0 text-muted-subtle" />
              )}
            </button>
          ))}
      </div>
      <form action={markInvoice} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={invoiceId} />
        <input type="hidden" name="action" value="issued" />
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Kapott számlaszám
          <input name="invoice_number" required placeholder="pl. WRKR-2026-227" className={`${inputClass} py-1.5`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Kelte
          <input type="date" name="date" defaultValue={today} className={`${inputClass} py-1.5`} />
        </label>
        <Button type="submit" size="sm">
          Kiállítva
        </Button>
      </form>
    </Card>
  );
}

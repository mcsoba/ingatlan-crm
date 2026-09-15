"use client";

import { useState } from "react";
import { XCircle, RotateCcw } from "lucide-react";
import { markDealLost, reopenDeal } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

type LostDealPanelProps = {
  dealId: string;
  status: string;
  lostReason: string | null;
  lostAt: string | null;
};

export function LostDealPanel({ dealId, status, lostReason, lostAt }: LostDealPanelProps) {
  const [open, setOpen] = useState(false);
  const markLostWithId = markDealLost.bind(null, dealId);
  const reopenWithId = reopenDeal.bind(null, dealId);

  if (status === "lost") {
    return (
      <Card className="border-danger/30 bg-danger-soft p-4 text-sm">
        <div className="flex items-center gap-1.5 font-medium text-danger">
          <XCircle className="h-4 w-4" strokeWidth={1.75} />
          Elveszett deal
        </div>
        {lostAt && (
          <div className="mt-1 text-xs text-muted">
            {new Date(lostAt).toLocaleDateString("hu-HU")}
          </div>
        )}
        {lostReason && <p className="mt-1.5 text-foreground">{lostReason}</p>}
        <form action={reopenWithId} className="mt-3">
          <Button type="submit" variant="secondary" size="sm">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Deal újranyitása
          </Button>
        </form>
      </Card>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-danger"
      >
        <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
        Elveszettnek jelölés
      </button>
    );
  }

  return (
    <Card className="p-4">
      <form action={markLostWithId} className={fieldGroupClass}>
        <span className={labelClass}>Miért hiúsult meg?</span>
        <textarea
          name="lost_reason"
          rows={2}
          placeholder="Pl. túl drágának találta, más ingatlanost választott, meggondolta magát…"
          className={inputClass}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="danger" size="sm">
            Elveszettnek jelölés
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Mégse
          </Button>
        </div>
      </form>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Building2, Clock } from "lucide-react";
import { moveDeal } from "./actions";
import { Card } from "@/components/ui/card";

export type DealCard = {
  id: string;
  stageId: string;
  contactName: string;
  propertyAddress: string | null;
  dealAmount: number | null;
  isStale: boolean;
  daysSinceUpdate: number;
};

function formatCompactHuf(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${millions.toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M Ft`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000).toLocaleString("hu-HU")} E Ft`;
  }
  return `${amount.toLocaleString("hu-HU")} Ft`;
}

export type Stage = {
  id: string;
  name: string;
  position: number;
};

export function PipelineBoard({
  stages,
  deals,
}: {
  stages: Stage[];
  deals: DealCard[];
}) {
  const [cards, setCards] = useState(deals);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStageId, setHoverStageId] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!draggingId) return;

    function stageAtPoint(x: number, y: number): string | null {
      for (const [stageId, el] of columnRefs.current) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return stageId;
        }
      }
      return null;
    }

    function handlePointerMove(e: PointerEvent) {
      setHoverStageId(stageAtPoint(e.clientX, e.clientY));
    }

    function handlePointerUp(e: PointerEvent) {
      const dealId = draggingId;
      const stageId = stageAtPoint(e.clientX, e.clientY);

      setDraggingId(null);
      setHoverStageId(null);

      if (!dealId || !stageId) return;

      setCards((prev) =>
        prev.map((card) =>
          card.id === dealId
            ? { ...card, stageId, isStale: false, daysSinceUpdate: 0 }
            : card,
        ),
      );

      moveDeal(dealId, stageId).catch(() => {
        // Best-effort optimistic update — a reload re-syncs on the rare
        // failure.
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingId]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => (
        <div
          key={stage.id}
          ref={(el) => {
            if (el) columnRefs.current.set(stage.id, el);
            else columnRefs.current.delete(stage.id);
          }}
          className={`w-64 flex-shrink-0 rounded-xl p-2.5 transition-colors ${
            hoverStageId === stage.id ? "bg-accent-soft" : "bg-background"
          }`}
        >
          <div className="mb-3 flex items-center gap-2 px-1 text-sm font-medium text-foreground">
            {stage.name}
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs text-muted">
              {cards.filter((c) => c.stageId === stage.id).length}
            </span>
            {(() => {
              const total = cards
                .filter((c) => c.stageId === stage.id)
                .reduce((sum, c) => sum + (c.dealAmount ?? 0), 0);
              return total > 0 ? (
                <span className="ml-auto text-xs font-normal text-muted-subtle">
                  {formatCompactHuf(total)}
                </span>
              ) : null;
            })()}
          </div>

          <div className="flex flex-col gap-2">
            {cards
              .filter((card) => card.stageId === stage.id)
              .map((card) => (
                <Card
                  key={card.id}
                  onPointerDown={() => setDraggingId(card.id)}
                  title={card.isStale ? `${card.daysSinceUpdate} napja nincs mozgás ezen a dealen` : undefined}
                  className={`cursor-grab p-3 text-sm shadow-sm select-none active:cursor-grabbing ${
                    draggingId === card.id ? "opacity-50" : ""
                  } ${card.isStale ? "border-warning/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-foreground">
                      {card.contactName}
                    </div>
                    <Link
                      href={`/dashboard/pipeline/${card.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="shrink-0 text-muted-subtle hover:text-accent"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {card.propertyAddress && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-muted">
                      <Building2 className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{card.propertyAddress}</span>
                    </div>
                  )}
                  {card.isStale && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-warning">
                      <Clock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                      <span>{card.daysSinceUpdate} napja mozdulatlan</span>
                    </div>
                  )}
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

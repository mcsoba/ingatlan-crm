"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { moveDeal } from "./actions";

export type DealCard = {
  id: string;
  stageId: string;
  contactName: string;
  propertyAddress: string | null;
};

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
        prev.map((card) => (card.id === dealId ? { ...card, stageId } : card)),
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
          className={`w-64 flex-shrink-0 rounded p-3 ${
            hoverStageId === stage.id ? "bg-neutral-200" : "bg-neutral-50"
          }`}
        >
          <div className="mb-3 text-sm font-medium text-neutral-700">
            {stage.name}{" "}
            <span className="text-neutral-400">
              {cards.filter((c) => c.stageId === stage.id).length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {cards
              .filter((card) => card.stageId === stage.id)
              .map((card) => (
                <div
                  key={card.id}
                  onPointerDown={() => setDraggingId(card.id)}
                  className={`cursor-grab select-none rounded border border-neutral-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing ${
                    draggingId === card.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{card.contactName}</div>
                    <Link
                      href={`/dashboard/pipeline/${card.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="shrink-0 text-xs text-neutral-400 hover:text-neutral-900 hover:underline"
                    >
                      Részletek
                    </Link>
                  </div>
                  {card.propertyAddress && (
                    <div className="mt-1 text-neutral-500">
                      {card.propertyAddress}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

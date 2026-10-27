"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveDeal } from "../actions";

// Pipedrive-style stage bar: every stage up to and including the current one
// is filled; clicking any stage moves the deal there.
export function StageProgress({
  dealId,
  stages,
  currentStageId,
  disabled,
}: {
  dealId: string;
  stages: { id: string; name: string }[];
  currentStageId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticId, setOptimisticId] = useState(currentStageId);
  const currentIndex = stages.findIndex((s) => s.id === optimisticId);

  function goTo(stageId: string) {
    if (disabled || stageId === optimisticId) return;
    setOptimisticId(stageId);
    startTransition(async () => {
      try {
        await moveDeal(dealId, stageId);
      } catch {
        setOptimisticId(currentStageId);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Deal szakasza"
      className={`flex gap-1 overflow-x-auto ${isPending ? "opacity-70" : ""}`}
    >
      {stages.map((stage, index) => {
        const reached = index <= currentIndex;
        const current = index === currentIndex;
        return (
          <button
            key={stage.id}
            type="button"
            disabled={disabled}
            aria-current={current ? "step" : undefined}
            onClick={() => goTo(stage.id)}
            className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors disabled:cursor-not-allowed ${
              current
                ? "bg-accent text-white"
                : reached
                  ? "bg-accent-soft text-accent hover:bg-accent/20"
                  : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
            title={stage.name}
          >
            {stage.name}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Building2, Clock, MessageSquarePlus } from "lucide-react";
import { logDealActivity, moveDeal, scheduleDealFollowUp } from "./actions";
import { Card } from "@/components/ui/card";

export type DealCard = {
  id: string;
  stageId: string;
  contactName: string;
  propertyAddress: string | null;
  dealAmount: number | null;
  ownerId: string | null;
  ownerName: string | null;
  dealType: "sale" | "rent";
  activityStatus: "overdue" | "today" | "scheduled" | "none";
  isClosed: boolean;
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const ACTIVITY_INDICATOR = {
  overdue: { label: "Lejárt teendő", className: "bg-danger" },
  today: { label: "Mai teendő", className: "bg-warning" },
  scheduled: { label: "Teendő ütemezve", className: "bg-success" },
  none: { label: "Nincs tervezett teendő", className: "bg-muted-subtle" },
} as const;

function QuickLog({ onLog }: { onLog: (type: "note" | "call", text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"note" | "call">("call");
  const [text, setText] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        title="Jegyzet / hívás rögzítése"
        aria-label="Jegyzet vagy hívás rögzítése"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen(true)}
        className="text-muted-subtle hover:text-accent"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <form
      onPointerDown={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onLog(type, text);
        setText("");
        setOpen(false);
      }}
      className="mt-2 flex w-full flex-col gap-1.5"
    >
      <div className="flex gap-1">
        {(["call", "note"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              type === t
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted"
            }`}
          >
            {t === "call" ? "Hívás" : "Jegyzet"}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Mi történt? (Enter = mentés)"
        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
      />
    </form>
  );
}

export type Stage = {
  id: string;
  name: string;
  position: number;
};

export function PipelineBoard({
  stages,
  deals,
  currentUserId,
}: {
  stages: Stage[];
  deals: DealCard[];
  currentUserId: string;
}) {
  const [cards, setCards] = useState(deals);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStageId, setHoverStageId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [onlyRent, setOnlyRent] = useState(false);
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

  function logActivity(dealId: string, type: "note" | "call", text: string) {
    setCards((prev) =>
      prev.map((card) =>
        card.id === dealId ? { ...card, isStale: false, daysSinceUpdate: 0 } : card,
      ),
    );
    logDealActivity(dealId, type, text).catch(() => {
      // Optimistic; a reload re-syncs on failure.
    });
  }

  function scheduleFollowUp(dealId: string, days: number) {
    setCards((prev) =>
      prev.map((card) =>
        card.id === dealId ? { ...card, activityStatus: days === 0 ? "today" : "scheduled" } : card,
      ),
    );
    scheduleDealFollowUp(dealId, days).catch(() => {
      // Optimistic like the stage move; a reload re-syncs on failure.
    });
  }

  function moveCardToStage(dealId: string, stageId: string) {
    setCards((prev) =>
      prev.map((card) =>
        card.id === dealId
          ? { ...card, stageId, isStale: false, daysSinceUpdate: 0 }
          : card,
      ),
    );
    moveDeal(dealId, stageId).catch(() => {
      // Same best-effort optimistic update as the drag path.
    });
  }

  const needle = query.trim().toLowerCase();
  const visibleCards = cards.filter((c) => {
    if (onlyMine && c.ownerId !== currentUserId) return false;
    if (onlyRent && c.dealType !== "rent") return false;
    if (
      onlyAttention &&
      (c.isClosed || (c.activityStatus !== "overdue" && c.activityStatus !== "none"))
    ) {
      return false;
    }
    if (!needle) return true;
    return `${c.contactName} ${c.propertyAddress ?? ""} ${c.ownerName ?? ""}`
      .toLowerCase()
      .includes(needle);
  });
  const openCards = visibleCards.filter((c) => !c.isClosed);
  const openValue = openCards.reduce((sum, c) => sum + (c.dealAmount ?? 0), 0);
  const needsAttention = openCards.filter(
    (c) => c.activityStatus === "overdue" || c.activityStatus === "none",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés kontakt, cím vagy felelős szerint…"
          className="w-72 max-w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        {(
          [
            ["Csak az enyéim", onlyMine, setOnlyMine],
            ["Figyelmet igényel", onlyAttention, setOnlyAttention],
            ["Csak bérlés", onlyRent, setOnlyRent],
          ] as const
        ).map(([label, active, set]) => (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => set(!active)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-muted">
          Nyitott dealek: <b className="text-foreground">{openCards.length}</b>
        </span>
        <span className="text-muted">
          Összérték:{" "}
          <b className="text-foreground">
            {openValue > 0 ? formatCompactHuf(openValue) : "—"}
          </b>
        </span>
        {needsAttention > 0 && (
          <span className="text-warning">
            {needsAttention} deal-hez nincs (vagy lejárt) teendő
          </span>
        )}
      </div>
    <div className="flex snap-x gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => (
        <div
          key={stage.id}
          ref={(el) => {
            if (el) columnRefs.current.set(stage.id, el);
            else columnRefs.current.delete(stage.id);
          }}
          className={`w-64 flex-shrink-0 snap-start rounded-xl p-2.5 transition-colors ${
            hoverStageId === stage.id ? "bg-accent-soft" : "bg-background"
          }`}
        >
          <div className="mb-3 flex items-center gap-2 px-1 text-sm font-medium text-foreground">
            {stage.name}
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs text-muted">
              {visibleCards.filter((c) => c.stageId === stage.id).length}
            </span>
            {(() => {
              const total = visibleCards
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
            {visibleCards
              .filter((card) => card.stageId === stage.id)
              .map((card) => (
                <Card
                  key={card.id}
                  onPointerDown={(e) => {
                    // Touch drags fight with horizontal scrolling and never
                    // deliver a reliable pointerup, so touch users move
                    // deals with the stage dropdown below instead.
                    if (e.pointerType === "mouse") setDraggingId(card.id);
                  }}
                  title={card.isStale ? `${card.daysSinceUpdate} napja nincs mozgás ezen a dealen` : undefined}
                  className={`cursor-grab p-3 text-sm shadow-sm select-none active:cursor-grabbing ${
                    draggingId === card.id ? "opacity-50" : ""
                  } ${card.isStale ? "border-warning/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-foreground">
                      {card.contactName}
                      {card.dealType === "rent" && (
                        <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent align-middle">
                          Bérlés
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/pipeline/${card.id}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="shrink-0 text-muted-subtle hover:text-accent"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  {card.dealAmount != null && card.dealAmount > 0 && (
                    <div className="mt-1 font-semibold text-foreground">
                      {formatCompactHuf(card.dealAmount)}
                    </div>
                  )}
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
                  <select
                    aria-label="Szakasz módosítása"
                    value={card.stageId}
                    onChange={(e) => moveCardToStage(card.id, e.target.value)}
                    className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground md:hidden"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {!card.isClosed &&
                    (card.activityStatus === "none" || card.activityStatus === "overdue") && (
                      <select
                        aria-label="Teendő ütemezése"
                        value=""
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => scheduleFollowUp(card.id, Number(e.target.value))}
                        className="mt-2 w-full rounded-md border border-dashed border-warning/60 bg-surface px-2 py-1 text-xs text-warning"
                      >
                        <option value="" disabled>
                          + Teendő ütemezése…
                        </option>
                        <option value="0">Ma</option>
                        <option value="1">Holnap</option>
                        <option value="3">3 nap múlva</option>
                        <option value="7">1 hét múlva</option>
                      </select>
                    )}
                  {!card.isClosed && (
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        title={ACTIVITY_INDICATOR[card.activityStatus].label}
                        aria-label={ACTIVITY_INDICATOR[card.activityStatus].label}
                        className={`h-2.5 w-2.5 rounded-full ${ACTIVITY_INDICATOR[card.activityStatus].className}`}
                      />
                      {card.ownerName && (
                        <span
                          title={card.ownerName}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent"
                        >
                          {initials(card.ownerName)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
                    <QuickLog onLog={(type, text) => logActivity(card.id, type, text)} />
                  </div>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}

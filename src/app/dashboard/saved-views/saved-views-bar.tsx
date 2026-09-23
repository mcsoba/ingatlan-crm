"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X, Bookmark } from "lucide-react";
import { createSavedView, deleteSavedView, type EntityType, type SavedView } from "./actions";
import { useToast } from "@/components/ui/toast";

export function SavedViewsBar({
  entityType,
  views,
  currentFilters,
}: {
  entityType: EntityType;
  views: SavedView[];
  currentFilters: Record<string, string | undefined>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const cleanFilters = Object.fromEntries(
    Object.entries(currentFilters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const hasActiveFilters = Object.keys(cleanFilters).length > 0;

  function buildHref(filters: Record<string, string>) {
    const qs = new URLSearchParams(filters).toString();
    return `/dashboard/${entityType}${qs ? `?${qs}` : ""}`;
  }

  function handleSave() {
    if (!name.trim()) return;
    const savedName = name.trim();
    startTransition(async () => {
      try {
        await createSavedView(entityType, savedName, cleanFilters);
        setName("");
        setIsSaving(false);
        toast({ title: `"${savedName}" nézet elmentve`, variant: "success" });
      } catch {
        toast({ title: "A nézet mentése nem sikerült", variant: "error" });
      }
    });
  }

  function handleDelete(id: string, viewName: string) {
    startTransition(async () => {
      try {
        await deleteSavedView(id, entityType);
        toast({ title: `"${viewName}" nézet törölve`, variant: "success" });
      } catch {
        toast({ title: "A nézet törlése nem sikerült", variant: "error" });
      }
    });
  }

  if (views.length === 0 && !hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.length > 0 && (
        <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-subtle" strokeWidth={1.75} />
      )}
      {views.map((v) => (
        <div
          key={v.id}
          className="group flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-1 pl-2.5 text-xs hover:border-accent/40"
        >
          <Link href={buildHref(v.filters)} className="text-foreground hover:text-accent">
            {v.name}
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(v.id, v.name)}
            disabled={isPending}
            aria-label={`"${v.name}" nézet törlése`}
            className="rounded-full p-0.5 text-muted-subtle opacity-0 hover:text-danger group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {hasActiveFilters &&
        (isSaving ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Nézet neve"
              className="w-32 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground placeholder:text-muted-subtle"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || isPending}
              className="text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-50"
            >
              Mentés
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSaving(false);
                setName("");
              }}
              disabled={isPending}
              className="text-xs text-muted hover:text-foreground"
            >
              Mégse
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSaving(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted hover:border-accent/40 hover:text-accent"
          >
            <Plus className="h-3 w-3" />
            Jelenlegi szűrés mentése
          </button>
        ))}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createTag,
  deleteTag,
  setContactTag,
  setPropertyTag,
  type TagRow,
} from "./actions";
import { TAG_COLORS } from "./constants";
import { inputClass } from "@/components/ui/styles";

const variantClasses: Record<string, string> = {
  neutral: "bg-background text-muted border-border",
  accent: "bg-accent-soft text-accent-hover border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

const colorSwatchClasses: Record<string, string> = {
  neutral: "bg-muted-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

type EntityType = "contact" | "property";

export function TagPicker({
  entityType,
  entityId,
  allTags,
  initialTagIds,
}: {
  entityType: EntityType;
  entityId: string;
  allTags: TagRow[];
  initialTagIds: string[];
}) {
  const [tags, setTags] = useState<TagRow[]>(allTags);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(
    new Set(initialTagIds),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("neutral");
  const [isPending, startTransition] = useTransition();

  function applyTag(tagId: string, assign: boolean) {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (assign) next.add(tagId);
      else next.delete(tagId);
      return next;
    });
    startTransition(async () => {
      if (entityType === "contact") await setContactTag(entityId, tagId, assign);
      else await setPropertyTag(entityId, tagId, assign);
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const tag = await createTag(name, newColor);
      setTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setAssignedIds((prev) => new Set(prev).add(tag.id));
      if (entityType === "contact") await setContactTag(entityId, tag.id, true);
      else await setPropertyTag(entityId, tag.id, true);
      setNewName("");
      setNewColor("neutral");
    });
  }

  function handleDeleteTag(tagId: string) {
    if (confirmDeleteId !== tagId) {
      setConfirmDeleteId(tagId);
      return;
    }
    startTransition(async () => {
      await deleteTag(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setAssignedIds((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
      setConfirmDeleteId(null);
    });
  }

  const assignedTags = tags.filter((t) => assignedIds.has(t.id));
  const unassignedTags = tags.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {assignedTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            disabled={isPending}
            onClick={() => applyTag(tag.id, false)}
            title="Eltávolítás"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70 ${variantClasses[tag.color] ?? variantClasses.neutral}`}
          >
            {tag.name}
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        ))}

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs font-medium text-muted-subtle hover:border-accent/50 hover:text-accent"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Címke
        </button>
      </div>

      {menuOpen && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm">
          {unassignedTags.length > 0 && (
            <div className="flex flex-col gap-1">
              {unassignedTags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => applyTag(tag.id, true)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium hover:opacity-80 ${variantClasses[tag.color] ?? variantClasses.neutral}`}
                  >
                    {tag.name}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDeleteTag(tag.id)}
                    onBlur={() => setConfirmDeleteId(null)}
                    title="Címke végleges törlése (minden kontaktról/ingatlanról)"
                    className="text-muted-subtle hover:text-danger"
                  >
                    {confirmDeleteId === tag.id ? (
                      <span className="text-xs text-danger">Biztos?</span>
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 border-t border-border-subtle pt-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Új címke neve…"
              className={`${inputClass} flex-1 py-1.5`}
            />
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  title={color}
                  className={`h-4 w-4 rounded-full ${colorSwatchClasses[color]} ${newColor === color ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!newName.trim() || isPending}
              onClick={handleCreate}
              className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Létrehozás
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

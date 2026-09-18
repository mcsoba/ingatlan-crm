"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, Users, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { updateTag, deleteTag, type TagWithUsage } from "./actions";
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

export function TagsManager({ initialTags }: { initialTags: TagWithUsage[] }) {
  const [tags, setTags] = useState(initialTags);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("neutral");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(tag: TagWithUsage) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(tagId: string) {
    const name = editName.trim();
    if (!name) return;
    startTransition(async () => {
      await updateTag(tagId, name, editColor);
      setTags((prev) =>
        prev.map((t) => (t.id === tagId ? { ...t, name, color: editColor } : t)),
      );
      setEditingId(null);
    });
  }

  function handleDelete(tagId: string) {
    if (confirmDeleteId !== tagId) {
      setConfirmDeleteId(tagId);
      return;
    }
    startTransition(async () => {
      await deleteTag(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setConfirmDeleteId(null);
    });
  }

  if (tags.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted">
        Még nincs egyetlen címke sem. Címkét egy kontakt vagy ingatlan szerkesztő
        oldalán hozhatsz létre először.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs font-medium text-muted-subtle">
              <th className="px-4 py-2.5">Címke</th>
              <th className="px-4 py-2.5">Kontaktokon</th>
              <th className="px-4 py-2.5">Ingatlanokon</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id} className="border-b border-border-subtle last:border-0">
                <td className="px-4 py-2.5">
                  {editingId === tag.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(tag.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className={`${inputClass} py-1 text-xs`}
                      />
                      <div className="flex items-center gap-1">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditColor(color)}
                            title={color}
                            className={`h-4 w-4 rounded-full ${colorSwatchClasses[color]} ${editColor === color ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${variantClasses[tag.color] ?? variantClasses.neutral}`}
                    >
                      {tag.name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {tag.contactCount}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {tag.propertyCount}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-3">
                    {editingId === tag.id ? (
                      <>
                        <button
                          type="button"
                          disabled={!editName.trim() || isPending}
                          onClick={() => saveEdit(tag.id)}
                          title="Mentés"
                          className="text-muted-subtle hover:text-success disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-xs text-muted-subtle hover:text-foreground"
                        >
                          Mégse
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(tag)}
                          title="Átnevezés / szín módosítása"
                          className="text-muted-subtle hover:text-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tag.id)}
                          onBlur={() => setConfirmDeleteId(null)}
                          disabled={isPending}
                          title="Végleges törlés minden kontaktról/ingatlanról"
                          className="text-xs font-medium text-muted-subtle hover:text-danger disabled:opacity-50"
                        >
                          {confirmDeleteId === tag.id ? (
                            <span className="text-danger">Biztos? Kattints újra</span>
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

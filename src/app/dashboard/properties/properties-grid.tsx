"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Scale, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { deleteProperty, bulkDeleteProperties, bulkUpdatePropertyStatus } from "./actions";
import { bulkAssignPropertyTag, type TagRow } from "../tags/actions";
import { restoreRecord } from "../trash/actions";
import { STATUS_LABELS, STATUS_VARIANTS } from "./constants";
import { useToast } from "@/components/ui/toast";

type PropertyRow = {
  id: string;
  address: string;
  price: number | null;
  size_sqm: number | null;
  status: string;
  view_count: number;
  photoUrl: string | null;
  tags: { id: string; name: string; color: string }[];
};

const tagVariant = (color: string) =>
  (["neutral", "accent", "success", "warning", "danger"].includes(color)
    ? color
    : "neutral") as "neutral" | "accent" | "success" | "warning" | "danger";

export function PropertiesGrid({
  properties,
  allTags,
}: {
  properties: PropertyRow[];
  allTags: TagRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkTag, setBulkTag] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setConfirmDelete(false);
    setBulkTag("");
    setBulkStatus("");
  }

  function handleBulkDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkDeleteProperties(ids);
      clearSelection();
      toast({
        title: `${ids.length} ingatlan törölve`,
        variant: "success",
        action: {
          label: "Visszavonás",
          onClick: () =>
            startTransition(() => {
              ids.forEach((id) => restoreRecord("properties", id));
            }),
        },
      });
    });
  }

  function handleSingleDelete(id: string, address: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteProperty(fd);
      toast({
        title: `${address} törölve`,
        variant: "success",
        action: {
          label: "Visszavonás",
          onClick: () => startTransition(() => restoreRecord("properties", id)),
        },
      });
    });
  }

  function handleBulkTag() {
    if (!bulkTag) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkAssignPropertyTag(ids, bulkTag);
      clearSelection();
    });
  }

  function handleBulkStatus() {
    if (!bulkStatus) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdatePropertyStatus(ids, bulkStatus);
      clearSelection();
      toast({
        title: `${ids.length} ingatlan státusza módosítva: ${STATUS_LABELS[bulkStatus] ?? bulkStatus}`,
        variant: "success",
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
          <span className="font-medium text-accent-hover">
            {selected.size} kiválasztva
          </span>
          {selected.size >= 2 && selected.size <= 4 && (
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/properties/compare?ids=${Array.from(selected).join(",")}`)
              }
              className={buttonVariants("secondary", "sm")}
            >
              <Scale className="h-3.5 w-3.5" strokeWidth={1.75} />
              Összehasonlítás
            </button>
          )}
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            disabled={isPending}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">Státusz módosítása…</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkStatus}
            disabled={!bulkStatus || isPending}
            className={buttonVariants("secondary", "sm")}
          >
            Alkalmaz
          </button>
          {allTags.length > 0 && (
            <>
              <select
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                disabled={isPending}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">Címke hozzáadása…</option>
                {allTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkTag}
                disabled={!bulkTag || isPending}
                className={buttonVariants("secondary", "sm")}
              >
                Alkalmaz
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleBulkDelete}
            onBlur={() => setConfirmDelete(false)}
            disabled={isPending}
            className={`${buttonVariants("danger", "sm")} ml-auto`}
          >
            {confirmDelete ? "Biztos? Kattints újra" : "Kijelöltek törlése"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isPending}
            className={buttonVariants("ghost", "sm")}
          >
            Mégse
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {properties.map((property) => (
          <Card key={property.id} className="relative overflow-hidden p-3">
            <label className="absolute top-2 left-2 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-surface/90 shadow-sm">
              <input
                type="checkbox"
                checked={selected.has(property.id)}
                onChange={() => toggleOne(property.id)}
                aria-label={`${property.address} kijelölése`}
                className="h-3.5 w-3.5 accent-[var(--accent)]"
              />
            </label>
            <Link href={`/dashboard/properties/${property.id}/edit`}>
              {property.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={property.photoUrl}
                  alt={property.address}
                  className="mb-3 -mx-3 -mt-3 h-32 object-cover"
                  style={{ width: "calc(100% + 1.5rem)" }}
                />
              ) : (
                <div className="mb-3 -mx-3 -mt-3 flex h-32 items-center justify-center bg-background text-muted-subtle">
                  <ImageOff className="h-6 w-6" strokeWidth={1.5} />
                </div>
              )}
              <div className="font-medium text-foreground">
                {property.address}
              </div>
            </Link>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm text-muted">
              <span>
                {property.price
                  ? `${property.price.toLocaleString("hu-HU")} Ft`
                  : "—"}
                {property.size_sqm ? ` · ${property.size_sqm} m²` : ""}
              </span>
              {property.status !== "available" && (
                <Badge variant={STATUS_VARIANTS[property.status] ?? "neutral"}>
                  {STATUS_LABELS[property.status] ?? property.status}
                </Badge>
              )}
            </div>
            {property.view_count > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-subtle">
                <Eye className="h-3 w-3" strokeWidth={1.75} />
                {property.view_count} megtekintés
              </div>
            )}
            {property.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {property.tags.map((t) => (
                  <Badge key={t.id} variant={tagVariant(t.color)}>
                    {t.name}
                  </Badge>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSingleDelete(property.id, property.address)}
              className="mt-2 text-xs text-muted hover:text-danger disabled:opacity-50"
            >
              Törlés
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

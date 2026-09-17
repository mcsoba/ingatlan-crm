"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Scale, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { deleteProperty, bulkDeleteProperties } from "./actions";
import { STATUS_LABELS, STATUS_VARIANTS } from "./constants";

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

export function PropertiesGrid({ properties }: { properties: PropertyRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

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
            <form action={deleteProperty} className="mt-2">
              <input type="hidden" name="id" value={property.id} />
              <button
                type="submit"
                className="text-xs text-muted hover:text-danger"
              >
                Törlés
              </button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GripVertical, X } from "lucide-react";
import { deletePropertyPhoto, reorderPropertyPhotos } from "./actions";

export type GalleryPhoto = { id: string; url: string };

export function PropertyGallery({
  propertyId,
  photos: initialPhotos,
}: {
  propertyId: string;
  photos: GalleryPhoto[];
}) {
  // Szándékosan NEM szinkronizáljuk ezt az initialPhotos prop-pal minden
  // renderelésnél (sem effect-tel, sem render-idejű összehasonlítással) —
  // a reorderPropertyPhotos/deletePropertyPhoto hívás nyomán érkező
  // revalidatePath egy Next.js Router-frissítést indít, ami ugyanabban a
  // pillanatban ütközött egy render-idejű setState-tel ("Cannot update a
  // component ('Router') while rendering a different component" hiba,
  // élőben Chrome-mal észlelve). Helyette mindkét műveletet optimista
  // helyi state-módosítással kezeljük, a szerver-hívást useTransition-be
  // csomagolva — így a helyi állapot mindig konzisztens marad, prop-
  // szinkronizálásra nincs szükség.
  const [photos, setPhotos] = useState(initialPhotos);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  function handleDelete(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    startTransition(() => {
      const formData = new FormData();
      formData.set("photo_id", photoId);
      formData.set("property_id", propertyId);
      deletePropertyPhoto(formData).catch(() => {
        // Best-effort — egy oldal-frissítés visszaállítja a valós állapotot.
      });
    });
  }

  useEffect(() => {
    if (!draggingId) return;

    function idAtPoint(x: number, y: number): string | null {
      for (const [id, el] of itemRefs.current) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return id;
        }
      }
      return null;
    }

    function handlePointerMove(e: PointerEvent) {
      setHoverId(idAtPoint(e.clientX, e.clientY));
    }

    function handlePointerUp(e: PointerEvent) {
      const sourceId = draggingId;
      const targetId = idAtPoint(e.clientX, e.clientY);
      setDraggingId(null);
      setHoverId(null);

      if (!sourceId || !targetId || sourceId === targetId) return;

      const next = [...photos];
      const fromIndex = next.findIndex((p) => p.id === sourceId);
      const toIndex = next.findIndex((p) => p.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      // A setState-et és a szerver-hívást szándékosan KÜLÖN lépésként
      // hívjuk (nem a setPhotos updater-függvényén belülről) — a
      // startTransition renderelés közbeni hívása React-hibát dob
      // ("Cannot call startTransition while rendering"), ha updater-
      // callbacken belülről történne.
      setPhotos(next);
      startTransition(() => {
        reorderPropertyPhotos(propertyId, next.map((p) => p.id)).catch(() => {
          // Best-effort — egy oldal-frissítés visszaállítja a valós sorrendet.
        });
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingId, propertyId, photos]);

  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          ref={(el) => {
            if (el) itemRefs.current.set(photo.id, el);
            else itemRefs.current.delete(photo.id);
          }}
          className={`group relative aspect-square select-none rounded-lg transition-opacity ${
            draggingId === photo.id ? "opacity-40" : ""
          } ${hoverId === photo.id && draggingId && draggingId !== photo.id ? "ring-2 ring-accent" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className="h-full w-full rounded-lg object-cover"
            draggable={false}
          />
          {index === 0 && (
            <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              Borítókép
            </span>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setDraggingId(photo.id);
            }}
            title="Húzd a sorrend módosításához"
            className="absolute top-1 left-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(photo.id)}
            className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

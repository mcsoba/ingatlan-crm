"use client";

import { X } from "lucide-react";
import { deletePropertyPhoto } from "./actions";

export type GalleryPhoto = { id: string; url: string };

export function PropertyGallery({
  propertyId,
  photos,
}: {
  propertyId: string;
  photos: GalleryPhoto[];
}) {
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            className="h-full w-full rounded-lg object-cover"
          />
          <form action={deletePropertyPhoto} className="absolute top-1 right-1">
            <input type="hidden" name="photo_id" value={photo.id} />
            <input type="hidden" name="property_id" value={propertyId} />
            <button
              type="submit"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

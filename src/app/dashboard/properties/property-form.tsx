"use client";

type PropertyFormProps = {
  action: (formData: FormData) => void;
  defaultValues?: {
    address?: string;
    price?: number | null;
    size_sqm?: number | null;
    features?: { notes?: string } | null;
  };
  submitLabel: string;
};

export function PropertyForm({
  action,
  defaultValues,
  submitLabel,
}: PropertyFormProps) {
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Cím</span>
        <input
          name="address"
          required
          defaultValue={defaultValues?.address}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Ár (Ft)</span>
        <input
          name="price"
          type="number"
          step="1"
          defaultValue={defaultValues?.price ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Alapterület (m²)</span>
        <input
          name="size_sqm"
          type="number"
          step="1"
          defaultValue={defaultValues?.size_sqm ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Jellemzők / jegyzet</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultValues?.features?.notes ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Fotó</span>
        <input
          name="photo"
          type="file"
          accept="image/*"
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}

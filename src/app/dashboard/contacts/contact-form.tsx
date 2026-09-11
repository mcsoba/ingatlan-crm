"use client";

type ContactFormProps = {
  action: (formData: FormData) => void;
  defaultValues?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    source?: string;
    status?: string;
    notes?: string | null;
  };
  submitLabel: string;
};

export function ContactForm({
  action,
  defaultValues,
  submitLabel,
}: ContactFormProps) {
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Név</span>
        <input
          name="name"
          required
          defaultValue={defaultValues?.name}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Email</span>
        <input
          type="email"
          name="email"
          defaultValue={defaultValues?.email ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Telefon</span>
        <input
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Forrás</span>
        <select
          name="source"
          defaultValue={defaultValues?.source ?? "other"}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="website">Weboldal</option>
          <option value="referral">Ajánlás</option>
          <option value="phone">Telefon</option>
          <option value="walk_in">Betérő</option>
          <option value="other">Egyéb</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Státusz</span>
        <select
          name="status"
          defaultValue={defaultValues?.status ?? "new"}
          className="rounded border border-neutral-300 px-3 py-2"
        >
          <option value="new">Új</option>
          <option value="contacted">Felvéve a kapcsolat</option>
          <option value="qualified">Minősített</option>
          <option value="inactive">Inaktív</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">Jegyzet</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
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

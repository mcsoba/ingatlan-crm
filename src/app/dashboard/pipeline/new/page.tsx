import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDeal } from "../actions";

export default async function NewDealPage() {
  const supabase = await createClient();

  const [{ data: contacts }, { data: properties }] = await Promise.all([
    supabase.from("contacts").select("id, name").order("name"),
    supabase.from("properties").select("id, address").order("address"),
  ]);

  if (!contacts || contacts.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Új deal</h1>
        <p className="mt-4 text-neutral-600">
          Deal létrehozásához előbb kell legalább egy kontakt.{" "}
          <Link
            href="/dashboard/contacts/new"
            className="underline hover:text-neutral-900"
          >
            Új kontakt létrehozása
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Új deal</h1>

      <form action={createDeal} className="mt-6 flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">Kontakt</span>
          <select
            name="contact_id"
            required
            defaultValue=""
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="" disabled>
              Válassz kontaktot
            </option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">
            Ingatlan (opcionális)
          </span>
          <select
            name="property_id"
            defaultValue=""
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="">Nincs kiválasztva</option>
            {properties?.map((property) => (
              <option key={property.id} value={property.id}>
                {property.address}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Létrehozás
        </button>
      </form>
    </div>
  );
}

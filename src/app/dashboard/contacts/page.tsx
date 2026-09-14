import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteContact } from "./actions";

const SOURCE_LABELS: Record<string, string> = {
  website: "Weboldal",
  referral: "Ajánlás",
  phone: "Telefon",
  walk_in: "Betérő",
  other: "Egyéb",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Új",
  contacted: "Felvéve",
  qualified: "Minősített",
  inactive: "Inaktív",
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("id, name, email, phone, source, status")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: contacts, error } = await query;

  if (error) throw error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kontaktok</h1>
        <Link
          href="/dashboard/contacts/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Új kontakt
        </Link>
      </div>

      <form className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Keresés név szerint…"
          className="max-w-xs flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
        >
          Keresés
        </button>
        {q && (
          <Link
            href="/dashboard/contacts"
            className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Törlés
          </Link>
        )}
      </form>

      {contacts.length === 0 ? (
        <p className="mt-6 text-neutral-500">
          {q ? "Nincs a keresésnek megfelelő kontakt." : "Még nincs kontakt."}
        </p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 font-normal">Név</th>
              <th className="font-normal">Elérhetőség</th>
              <th className="font-normal">Forrás</th>
              <th className="font-normal">Státusz</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-neutral-100">
                <td className="py-2">
                  <Link
                    href={`/dashboard/contacts/${contact.id}/edit`}
                    className="hover:underline"
                  >
                    {contact.name}
                  </Link>
                </td>
                <td className="text-neutral-600">
                  {contact.email || contact.phone || "—"}
                </td>
                <td className="text-neutral-600">
                  {SOURCE_LABELS[contact.source] ?? contact.source}
                </td>
                <td className="text-neutral-600">
                  {STATUS_LABELS[contact.status] ?? contact.status}
                </td>
                <td className="text-right">
                  <form action={deleteContact}>
                    <input type="hidden" name="id" value={contact.id} />
                    <button
                      type="submit"
                      className="text-red-600 hover:underline"
                    >
                      Törlés
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteProperty } from "./actions";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("properties")
    .select("id, address, price, size_sqm, photo_path")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("address", `%${q}%`);

  const { data: properties, error } = await query;

  if (error) throw error;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ingatlanok</h1>
        <Link
          href="/dashboard/properties/new"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Új ingatlan
        </Link>
      </div>

      <form className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Keresés cím szerint…"
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
            href="/dashboard/properties"
            className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Törlés
          </Link>
        )}
      </form>

      {properties.length === 0 ? (
        <p className="mt-6 text-neutral-500">
          {q ? "Nincs a keresésnek megfelelő ingatlan." : "Még nincs ingatlan."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {properties.map((property) => {
            const photoUrl = property.photo_path
              ? supabase.storage
                  .from("property-photos")
                  .getPublicUrl(property.photo_path).data.publicUrl
              : null;

            return (
              <div
                key={property.id}
                className="rounded border border-neutral-200 p-3"
              >
                <Link href={`/dashboard/properties/${property.id}/edit`}>
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={property.address}
                      className="mb-2 h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="mb-2 flex h-32 w-full items-center justify-center rounded bg-neutral-100 text-neutral-400">
                      Nincs fotó
                    </div>
                  )}
                  <div className="font-medium">{property.address}</div>
                </Link>
                <div className="text-sm text-neutral-600">
                  {property.price
                    ? `${property.price.toLocaleString("hu-HU")} Ft`
                    : "—"}
                  {property.size_sqm ? ` · ${property.size_sqm} m²` : ""}
                </div>
                <form action={deleteProperty} className="mt-2">
                  <input type="hidden" name="id" value={property.id} />
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Törlés
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

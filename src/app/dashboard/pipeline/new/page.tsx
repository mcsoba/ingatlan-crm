import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDeal } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass, linkClass } from "@/components/ui/styles";

export default async function NewDealPage() {
  const supabase = await createClient();

  const [{ data: contacts }, { data: properties }] = await Promise.all([
    supabase.from("contacts").select("id, name").order("name"),
    supabase.from("properties").select("id, address").order("address"),
  ]);

  if (!contacts || contacts.length === 0) {
    return (
      <div>
        <PageHeader title="Új deal" />
        <p className="mt-4 text-sm text-muted">
          Deal létrehozásához előbb kell legalább egy kontakt.{" "}
          <Link href="/dashboard/contacts/new" className={linkClass}>
            Új kontakt létrehozása
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Új deal"
        action={
          <Link
            href="/dashboard/pipeline"
            className="text-sm text-muted hover:text-accent"
          >
            ← Pipeline
          </Link>
        }
      />

      <Card className="max-w-md p-5">
        <form action={createDeal} className="flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Kontakt</span>
            <select
              name="contact_id"
              required
              defaultValue=""
              className={inputClass}
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
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Ingatlan (opcionális)</span>
            <select name="property_id" defaultValue="" className={inputClass}>
              <option value="">Nincs kiválasztva</option>
              {properties?.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.address}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" className="mt-1">
            Létrehozás
          </Button>
        </form>
      </Card>
    </div>
  );
}

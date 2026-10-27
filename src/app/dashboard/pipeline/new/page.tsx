import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { createDeal } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass, linkClass } from "@/components/ui/styles";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  // ?contact=<id>: a kontakt oldaláról indítva előre kiválasztva
  const { contact: preselectedContact } = await searchParams;
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const [{ data: contacts }, { data: properties }, { data: members }] =
    await Promise.all([
      supabase.from("contacts").select("id, name").order("name"),
      supabase.from("properties").select("id, address").order("address"),
      supabase.from("profiles").select("id, full_name").order("created_at"),
    ]);

  const emailById = new Map<string, string>();
  if (members && members.length > 0) {
    const admin = createAdminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
    const memberIds = new Set(members.map((m) => m.id));
    for (const user of usersPage?.users ?? []) {
      if (memberIds.has(user.id)) emailById.set(user.id, user.email ?? "");
    }
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div>
        <PageHeader title="Új üzlet" />
        <p className="mt-4 text-sm text-muted">
          Üzlet létrehozásához előbb kell legalább egy kontakt.{" "}
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
        title="Új üzlet"
        action={
          <Link
            href="/dashboard/pipeline"
            className="text-sm text-muted hover:text-accent"
          >
            ← Üzletek
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
              defaultValue={preselectedContact ?? ""}
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

          <div className={fieldGroupClass}>
            <span className={labelClass}>Típus</span>
            <select name="deal_type" defaultValue="sale" className={inputClass}>
              <option value="sale">Eladás</option>
              <option value="rent">Bérlés</option>
            </select>
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Felelős ügynök</span>
            <select name="owner_id" defaultValue={profile.id} className={inputClass}>
              {(members ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || emailById.get(member.id) || "Ismeretlen"}
                  {member.id === profile.id ? " (te)" : ""}
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

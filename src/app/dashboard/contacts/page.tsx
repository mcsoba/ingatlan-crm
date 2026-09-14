import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteContact } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

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

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  new: "neutral",
  contacted: "accent",
  qualified: "success",
  inactive: "neutral",
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
    .select("id, name, email, phone, source, status, lead_score")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: contacts, error } = await query;

  if (error) throw error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kontaktok"
        description="Érdeklődők és ügyfelek egy helyen."
        action={
          <Link
            href="/dashboard/contacts/new"
            className={buttonVariants("primary")}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Új kontakt
          </Link>
        }
      />

      <form className="flex gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Keresés név szerint…"
            className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm placeholder:text-muted-subtle"
          />
        </div>
        <button type="submit" className={buttonVariants("secondary")}>
          Keresés
        </button>
        {q && (
          <Link href="/dashboard/contacts" className={buttonVariants("ghost")}>
            Törlés
          </Link>
        )}
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Nincs a keresésnek megfelelő kontakt" : "Még nincs kontakt"}
          description={
            q
              ? "Próbálj más keresőszót."
              : "Vegyél fel egy kontaktot, hogy elkezdhesd a pipeline-t építeni."
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Név</th>
                <th className="px-4 py-3 font-medium">Elérhetőség</th>
                <th className="px-4 py-3 font-medium">Forrás</th>
                <th className="px-4 py-3 font-medium">Státusz</th>
                <th className="px-4 py-3 font-medium">Pontszám</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-background"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/contacts/${contact.id}/edit`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {contact.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {contact.email || contact.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {SOURCE_LABELS[contact.source] ?? contact.source}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[contact.status] ?? "neutral"}>
                      {STATUS_LABELS[contact.status] ?? contact.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {contact.lead_score != null ? (
                      <Badge
                        variant={
                          contact.lead_score >= 70
                            ? "success"
                            : contact.lead_score >= 40
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {contact.lead_score}
                      </Badge>
                    ) : (
                      <span className="text-muted-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={contact.id} />
                      <button
                        type="submit"
                        className="text-xs text-muted hover:text-danger"
                      >
                        Törlés
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

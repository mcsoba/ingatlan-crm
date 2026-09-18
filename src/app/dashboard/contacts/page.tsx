import Link from "next/link";
import { Plus, Search, Users, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ImportContactsButton } from "./import-button";
import { ContactsTable } from "./contacts-table";
import { listAgencyTags } from "../tags/actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string; tag?: string }>;
}) {
  const { q, status, source, tag } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select("id, name, email, phone, source, status, lead_score, owner_id, created_at")
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("name", `%${q}%`);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);

  if (tag) {
    const { data: taggedRows } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", tag);
    const ids = (taggedRows ?? []).map((r) => r.contact_id);
    query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const [{ data: contacts, error }, allTags, { data: members }] = await Promise.all([
    query,
    listAgencyTags(),
    supabase.from("profiles").select("id, full_name"),
  ]);

  if (error) throw error;

  const nameByOwnerId = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const contactIds = (contacts ?? []).map((c) => c.id);
  const tagsByContact = new Map<string, { id: string; name: string; color: string }[]>();
  const lastActivityByContact = new Map<string, string>();
  if (contactIds.length > 0) {
    const [{ data: tagLinks }, { data: activityRows }] = await Promise.all([
      supabase
        .from("contact_tags")
        .select("contact_id, tags(id, name, color)")
        .in("contact_id", contactIds),
      // Ordered desc so the first row seen per contact is the most recent —
      // avoids a group-by, same approach as the tag map above.
      supabase
        .from("activities")
        .select("contact_id, created_at")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false }),
    ]);
    for (const link of tagLinks ?? []) {
      const t = link.tags as unknown as { id: string; name: string; color: string } | null;
      if (!t) continue;
      const list = tagsByContact.get(link.contact_id) ?? [];
      list.push(t);
      tagsByContact.set(link.contact_id, list);
    }
    for (const row of activityRows ?? []) {
      if (!row.contact_id || lastActivityByContact.has(row.contact_id)) continue;
      lastActivityByContact.set(row.contact_id, row.created_at);
    }
  }

  const NEGLECTED_AFTER_DAYS = 14;
  const NEGLECTABLE_STATUSES = new Set(["contacted", "qualified"]);
  const now = new Date().getTime();

  const hasFilters = Boolean(q || status || source || tag);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kontaktok"
        description="Érdeklődők és ügyfelek egy helyen."
        action={
          <div className="flex items-center gap-2">
            <a href="/dashboard/contacts/export" className={buttonVariants("secondary")}>
              <Download className="h-4 w-4" strokeWidth={1.75} />
              Export CSV
            </a>
            <ImportContactsButton />
            <Link
              href="/dashboard/contacts/new"
              className={buttonVariants("primary")}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Új kontakt
            </Link>
          </div>
        }
      />

      <form className="flex flex-wrap gap-2">
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
        <select name="status" defaultValue={status ?? ""} className={inputClass}>
          <option value="">Minden státusz</option>
          <option value="new">Új</option>
          <option value="contacted">Felvéve</option>
          <option value="qualified">Minősített</option>
          <option value="inactive">Inaktív</option>
        </select>
        <select name="source" defaultValue={source ?? ""} className={inputClass}>
          <option value="">Minden forrás</option>
          <option value="website">Weboldal</option>
          <option value="referral">Ajánlás</option>
          <option value="phone">Telefon</option>
          <option value="walk_in">Betérő</option>
          <option value="other">Egyéb</option>
        </select>
        {allTags.length > 0 && (
          <select name="tag" defaultValue={tag ?? ""} className={inputClass}>
            <option value="">Minden címke</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={buttonVariants("secondary")}>
          Szűrés
        </button>
        {hasFilters && (
          <Link href="/dashboard/contacts" className={buttonVariants("ghost")}>
            Törlés
          </Link>
        )}
      </form>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "Nincs a szűrésnek megfelelő kontakt" : "Még nincs kontakt"}
          description={
            hasFilters
              ? "Próbálj más keresőszót vagy szűrőt."
              : "Vegyél fel egy kontaktot, hogy elkezdhesd a pipeline-t építeni."
          }
        />
      ) : (
        <ContactsTable
          allTags={allTags}
          contacts={contacts.map((c) => {
            const lastActivityAt = lastActivityByContact.get(c.id) ?? c.created_at;
            const daysSinceActivity = Math.floor(
              (now - new Date(lastActivityAt).getTime()) / (24 * 60 * 60 * 1000),
            );
            return {
              ...c,
              tags: tagsByContact.get(c.id) ?? [],
              ownerName: c.owner_id ? (nameByOwnerId.get(c.owner_id) ?? null) : null,
              isNeglected:
                NEGLECTABLE_STATUSES.has(c.status) && daysSinceActivity >= NEGLECTED_AFTER_DAYS,
              daysSinceActivity,
            };
          })}
        />
      )}
    </div>
  );
}

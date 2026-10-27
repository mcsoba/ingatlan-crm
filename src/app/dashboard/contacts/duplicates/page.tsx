import { Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DuplicatesList, type ContactRow, type Cluster } from "./duplicates-list";

function normalizeText(value: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

// Union-find over the whole contact list, unioning any two contacts that
// share a normalized email, phone, or name -- so a chain of matches (A~B on
// email, B~C on phone) surfaces as one 3-way cluster instead of two
// separate, confusing pairs.
function buildClusters(contacts: ContactRow[]): Cluster[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const c of contacts) parent.set(c.id, c.id);

  const groupAndUnion = (keyFn: (c: ContactRow) => string) => {
    const groups = new Map<string, string[]>();
    for (const c of contacts) {
      const key = keyFn(c);
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(c.id);
      groups.set(key, list);
    }
    for (const ids of groups.values()) {
      for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
    }
  };
  groupAndUnion((c) => normalizeText(c.email));
  groupAndUnion((c) => normalizePhone(c.phone));
  groupAndUnion((c) => normalizeText(c.name));

  const byRoot = new Map<string, ContactRow[]>();
  for (const c of contacts) {
    const root = find(c.id);
    const list = byRoot.get(root) ?? [];
    list.push(c);
    byRoot.set(root, list);
  }

  const clusters: Cluster[] = [];
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
    const reasons = new Set<"email" | "phone" | "name">();
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        if (a.email && normalizeText(a.email) === normalizeText(b.email)) reasons.add("email");
        if (a.phone && normalizePhone(a.phone) === normalizePhone(b.phone)) reasons.add("phone");
        if (a.name && normalizeText(a.name) === normalizeText(b.name)) reasons.add("name");
      }
    }
    members.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    clusters.push({ reasons: [...reasons], members });
  }
  clusters.sort((a, b) => b.reasons.length - a.reasons.length);
  return clusters;
}

export default async function DuplicateContactsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, email, phone, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const contacts: ContactRow[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    createdAt: c.created_at,
  }));

  const clusters = buildClusters(contacts);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Duplikátum-kontaktok"
        description="Az összes kontaktot végigszkennelve, egy helyen mutatja a valószínű duplikátumokat."
        helpText="Azonos email, telefonszám vagy név alapján csoportosítva. Válaszd ki, melyik kontaktot tartsd meg -- a többi adatai (hiányzó email/telefon/jegyzet, kapcsolódó üzletek, aktivitások) átkerülnek rá, a duplikátumok pedig a lomtárba kerülnek."
      />

      {clusters.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Nincs valószínű duplikátum"
          description="Minden kontakt egyedi email, telefonszám és név alapján."
        />
      ) : (
        <DuplicatesList clusters={clusters} />
      )}
    </div>
  );
}

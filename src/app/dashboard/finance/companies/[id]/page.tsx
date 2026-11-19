import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Home, Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { deleteCompany } from "../../actions";
import { deleteCompanyPerson, setCompanyMembers } from "../../company-actions";
import { CompanyForm } from "../../company-form";
import { CompanyPersonForm, type TeamMemberOption } from "../../company-person-form";
import { CompanyFilesPanel, type CompanyFile } from "../../company-files-panel";
import { ConfirmDelete } from "../../confirm-delete";
import { SzamlazzSettingsCard } from "../../szamlazz-settings";
import { loadSzamlazzSettings } from "@/lib/szamlazz-server";
import { MigrationNotice, isMissingTable } from "../../migration-notice";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  COMPANY_DETAIL_SELECT,
  COMPANY_PERSON_ROLES,
  COMPANY_PERSON_ROLE_LABELS,
  COMPANY_PERSON_SELECT,
  formatDate,
  type CompanyDetail,
  type CompanyPersonRow,
} from "@/lib/finance";

function Saved({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-sm text-success">
      <Check className="h-4 w-4" />
      {children}
    </p>
  );
}

/** A cég adatai egy blokkban — partnernek, könyvelőnek, banknak egyszerűen kimásolható. */
function summaryLines(c: CompanyDetail, directors: CompanyPersonRow[]): string[] {
  return [
    c.name,
    c.address && `Székhely: ${c.address}`,
    c.registration_number && `Cégjegyzékszám: ${c.registration_number}`,
    c.tax_number && `Adószám: ${c.tax_number}`,
    c.eu_vat_number && `Közösségi adószám: ${c.eu_vat_number}`,
    c.bank_account && `Bankszámlaszám: ${c.bank_account}${c.bank_name ? ` (${c.bank_name})` : ""}`,
    c.iban && `IBAN: ${c.iban}`,
    c.swift && `SWIFT: ${c.swift}`,
    directors.length > 0 && `Képviseli: ${directors.map((d) => d.name).join(", ")} ügyvezető`,
    c.email && `E-mail: ${c.email}`,
    c.phone && `Telefon: ${c.phone}`,
  ].filter(Boolean) as string[];
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; person_saved?: string; members_saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { profile } = await ensureCurrentUserProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.from("finance_companies").select(COMPANY_DETAIL_SELECT).eq("id", id).maybeSingle();
  if (isMissingTable(error)) return <MigrationNotice file="0046_company_profile.sql" />;
  if (!data) notFound();
  const company = data as unknown as CompanyDetail;

  const [{ data: peopleRows }, { data: fileRows }, { data: memberRows }, { data: lodgingRows }, { count: invoiceCount }, szamlazzSettings] = await Promise.all([
    supabase.from("finance_company_people").select(COMPANY_PERSON_SELECT).eq("company_id", id).order("name"),
    supabase.from("finance_company_files").select("id, filename, content_type, path, created_at").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, company_ids").order("full_name"),
    supabase.from("finance_lodgings").select("id, address").eq("company_id", id).order("address"),
    supabase.from("finance_invoices").select("id", { count: "exact", head: true }).eq("company_id", id),
    profile.role === "owner" || profile.role === "admin" ? loadSzamlazzSettings(profile.agency_id) : Promise.resolve(null),
  ]);
  const szamlazz = szamlazzSettings?.get(id) ?? null;

  const people = (peopleRows ?? []) as CompanyPersonRow[];
  const members = (memberRows ?? []) as (TeamMemberOption & { company_ids: string[] | null })[];
  const memberName = new Map(members.map((m) => [m.id, m.full_name]));
  const directors = people.filter((p) => p.role === "director" && !p.end_date);
  const sortedPeople = [...people].sort(
    (a, b) => Number(Boolean(a.end_date)) - Number(Boolean(b.end_date)) || COMPANY_PERSON_ROLES.indexOf(a.role) - COMPANY_PERSON_ROLES.indexOf(b.role),
  );

  // Képeknél előnézet: rövid életű aláírt URL-ek egy kérésben
  const imageRows = (fileRows ?? []).filter((f) => (f.content_type ?? "").startsWith("image/"));
  const { data: signed } = imageRows.length
    ? await supabase.storage.from("finance-receipts").createSignedUrls(imageRows.map((f) => f.path as string), 3600)
    : { data: [] };
  const thumbByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const files: CompanyFile[] = (fileRows ?? []).map((f) => ({
    id: f.id,
    filename: f.filename,
    content_type: f.content_type,
    created_at: f.created_at,
    thumbUrl: thumbByPath.get(f.path) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/companies" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a cégekhez
      </Link>
      <PageHeader
        title={company.name}
        description={[company.tax_number && `Adószám: ${company.tax_number}`, directors.length > 0 && `Ügyvezető: ${directors.map((d) => d.name).join(", ")}`]
          .filter(Boolean)
          .join(" · ") || "Cég adatlapja"}
      />
      {sp.saved && <Saved>Cégadatok mentve</Saved>}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CompanyForm key={JSON.stringify(company)} company={company} />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2 p-4">
            <div className="text-sm font-semibold text-foreground">Cégadatok egyben</div>
            <p className="text-xs text-muted">Kijelölhető és bemásolható e-mailbe, szerződésbe, űrlapba.</p>
            <pre className="select-all whitespace-pre-wrap rounded-lg bg-background p-3 font-sans text-sm leading-relaxed text-foreground">
              {summaryLines(company, directors).join("\n")}
            </pre>
          </Card>

          <Card className="flex flex-col p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Kapcsolódó</div>
            <Link
              href={`/dashboard/finance/invoices?company=${company.id}`}
              className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5 text-sm hover:bg-background"
            >
              <Receipt className="h-4 w-4 text-muted" />
              <span className="flex-1">Számlák és tételek</span>
              <span className="tabular-nums text-muted">{invoiceCount ?? 0}</span>
            </Link>
            <Link
              href={`/dashboard/finance/lodgings?company=${company.id}`}
              className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5 text-sm hover:bg-background"
            >
              <Home className="h-4 w-4 text-muted" />
              <span className="flex-1">Szállások</span>
              <span className="tabular-nums text-muted">{lodgingRows?.length ?? 0}</span>
            </Link>
          </Card>
        </div>
      </div>

      {/* ---------- személyek ---------- */}
      <Card id="szemelyek" className="flex scroll-mt-4 flex-col gap-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ügyvezetők, tagok, munkatársak ({people.filter((p) => !p.end_date).length})</h2>
          <p className="text-xs text-muted">Kattints egy névre a szerkesztéshez. Külsős (pl. könyvelő, csendestárs) is felvehető, nem kell CRM-fiók.</p>
        </div>
        {sp.person_saved && <Saved>Személy mentve</Saved>}

        {sortedPeople.length > 0 && (
          <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {sortedPeople.map((p) => (
              <details key={p.id} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm hover:bg-background">
                  <span className={`font-medium ${p.end_date ? "text-muted line-through" : "text-foreground"}`}>{p.name}</span>
                  <Badge variant={p.role === "director" ? "accent" : p.role === "owner" ? "success" : "neutral"}>{COMPANY_PERSON_ROLE_LABELS[p.role]}</Badge>
                  {p.position && <span className="text-xs text-muted">{p.position}</span>}
                  {p.ownership_percent !== null && <span className="text-xs text-muted">{Number(p.ownership_percent)}%</span>}
                  {p.profile_id && <Badge variant="neutral">CRM: {memberName.get(p.profile_id) ?? "felhasználó"}</Badge>}
                  {p.end_date && <span className="text-xs text-muted">kilépett: {formatDate(p.end_date)}</span>}
                  <span className="ml-auto text-xs text-muted">{[p.phone, p.email].filter(Boolean).join(" · ")}</span>
                </summary>
                <div className="flex flex-col gap-3 border-t border-border-subtle bg-background/40 p-3">
                  <CompanyPersonForm key={JSON.stringify(p)} companyId={company.id} person={p} members={members} />
                  <ConfirmDelete
                    action={deleteCompanyPerson}
                    fields={{ id: p.id, company_id: company.id }}
                    label="Személy törlése"
                    question="Ha csak kilépett, inkább add meg a befejezés dátumát. Végleg törlöd?"
                  />
                </div>
              </details>
            ))}
          </div>
        )}

        <details className="rounded-lg border border-dashed border-border p-3" open={people.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-accent">
            <Plus className="h-4 w-4" />
            Személy hozzáadása (ügyvezető, tag, munkatárs, könyvelő)
          </summary>
          <div className="mt-3">
            <CompanyPersonForm companyId={company.id} members={members} defaultRole={directors.length ? "employee" : "director"} />
          </div>
        </details>
      </Card>

      {/* ---------- Számlázz.hu ---------- */}
      {(profile.role === "owner" || profile.role === "admin") && (
        <SzamlazzSettingsCard
          companyId={company.id}
          settings={szamlazz && { key_hint: szamlazz.key_hint, invoice_prefix: szamlazz.invoice_prefix, e_invoice: szamlazz.e_invoice }}
          migrationMissing={szamlazzSettings === null}
        />
      )}

      {/* ---------- CRM-felhasználók ---------- */}
      <Card id="munkatarsak" className="flex scroll-mt-4 flex-col gap-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">CRM-felhasználók ebben a cégben</h2>
          <p className="text-xs text-muted">
            Akik ennek a cégnek dolgoznak — ez alapján szűr az oldalsáv cégválasztója és a szabadság-nyilvántartás. Ugyanez a Csapat oldalon is állítható.
            Új munkatársat a <Link href="/dashboard/team" className="text-accent hover:underline">Csapat</Link> oldalon lehet meghívni.
          </p>
        </div>
        {sp.members_saved && <Saved>Mentve</Saved>}
        <form action={setCompanyMembers} className="flex flex-col gap-3">
          <input type="hidden" name="company_id" value={company.id} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm hover:border-border">
                <input type="checkbox" name="member" value={m.id} defaultChecked={(m.company_ids ?? []).includes(company.id)} />
                <span className="truncate">{m.full_name || "Névtelen felhasználó"}</span>
                {m.id === profile.id && <span className="text-xs text-muted">(te)</span>}
              </label>
            ))}
          </div>
          <div>
            <Button type="submit" size="sm" variant="secondary">
              Mentés
            </Button>
          </div>
        </form>
      </Card>

      <CompanyFilesPanel agencyId={profile.agency_id} companyId={company.id} files={files} />

      <ConfirmDelete
        action={deleteCompany}
        fields={{ id: company.id }}
        label="Cég törlése"
        question="Csak tételek nélküli cég törölhető; a személyei és dokumentumai is törlődnek. Törlöd?"
      />
    </div>
  );
}

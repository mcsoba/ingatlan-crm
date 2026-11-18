import Link from "next/link";
import { Building, ChevronRight, FileText, Plus, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MigrationNotice, isMissingTable } from "../migration-notice";
import { COMPANY_DETAIL_SELECT, type CompanyDetail } from "@/lib/finance";

// Ami egy cégnél tipikusan kell (számlázás, bank, cégügyek) — ha hiányzik, jelezzük
const KEY_FIELDS: { key: keyof CompanyDetail; label: string }[] = [
  { key: "tax_number", label: "adószám" },
  { key: "registration_number", label: "cégjegyzékszám" },
  { key: "address", label: "székhely" },
  { key: "bank_account", label: "bankszámla" },
  { key: "iban", label: "IBAN" },
];

export default async function FinanceCompaniesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_companies").select(COMPANY_DETAIL_SELECT).order("sort_order").order("name");
  if (isMissingTable(error)) return <MigrationNotice file="0046_company_profile.sql" />;
  const companies = (data ?? []) as unknown as CompanyDetail[];

  const [{ data: people }, { data: files }, { data: members }] = await Promise.all([
    supabase.from("finance_company_people").select("company_id, name, role, end_date"),
    supabase.from("finance_company_files").select("company_id"),
    supabase.from("profiles").select("company_ids"),
  ]);

  const directors = new Map<string, string[]>();
  const peopleCount = new Map<string, number>();
  for (const p of people ?? []) {
    if (p.end_date) continue;
    peopleCount.set(p.company_id, (peopleCount.get(p.company_id) ?? 0) + 1);
    if (p.role === "director") directors.set(p.company_id, [...(directors.get(p.company_id) ?? []), p.name]);
  }
  const fileCount = new Map<string, number>();
  for (const f of files ?? []) fileCount.set(f.company_id, (fileCount.get(f.company_id) ?? 0) + 1);
  const memberCount = new Map<string, number>();
  for (const m of members ?? []) for (const id of (m.company_ids ?? []) as string[]) memberCount.set(id, (memberCount.get(id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cégek"
        description="Az iroda cégeinek adatlapja: cégadatok, bank, ügyvezetők és munkatársak, dokumentumok. Egy céghez tartozik minden számla, törzs és üzlet; az oldalsáv cégválasztójával minden lista szűrhető."
        action={
          <Link href="/dashboard/finance/companies/new" className={buttonVariants("primary", "sm")}>
            <Plus className="h-3.5 w-3.5" />
            Új cég
          </Link>
        }
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building}
          title="Még nincs cég felvéve"
          description="Vedd fel először a cégeket (pl. Workerbase, Interprop, Bluegate) — utána rögzíthetők a számlák."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => {
            const missing = KEY_FIELDS.filter((f) => !c[f.key]).map((f) => f.label);
            const dirs = directors.get(c.id) ?? [];
            return (
              <Link key={c.id} href={`/dashboard/finance/companies/${c.id}`} className="group">
                <Card className="flex h-full flex-col gap-3 p-5 transition-colors group-hover:border-accent">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? "#2e6ff2" }} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground">{c.name}</div>
                      <div className="text-xs text-muted">{[c.tax_number, c.registration_number].filter(Boolean).join(" · ") || "Nincs adószám megadva"}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted group-hover:text-accent" />
                  </div>
                  {c.address && <div className="text-sm text-muted">{c.address}</div>}
                  <div className="text-sm">
                    <span className="text-muted">Ügyvezető: </span>
                    {dirs.length ? dirs.join(", ") : <span className="text-warning">nincs megadva</span>}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1" title="Személyek (ügyvezető, tag, munkatárs, könyvelő)">
                      <UserRound className="h-3.5 w-3.5" />
                      {peopleCount.get(c.id) ?? 0} személy
                    </span>
                    <span className="inline-flex items-center gap-1" title="CRM-felhasználók ebben a cégben">
                      <Users className="h-3.5 w-3.5" />
                      {memberCount.get(c.id) ?? 0} CRM-felhasználó
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {fileCount.get(c.id) ?? 0} dokumentum
                    </span>
                  </div>
                  {missing.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="warning">Hiányzik: {missing.join(", ")}</Badge>
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

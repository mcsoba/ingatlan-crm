import { Building } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { saveCompany, deleteCompany } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClass } from "@/components/ui/styles";
import type { CompanyRow } from "@/lib/finance";
import { ConfirmDelete } from "../confirm-delete";

function CompanyFields({ company }: { company?: CompanyRow }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input name="name" required defaultValue={company?.name} placeholder="Cégnév (pl. Bluegate Housing Kft.)" className={inputClass} />
      <input name="tax_number" defaultValue={company?.tax_number ?? ""} placeholder="Adószám" className={inputClass} />
      <input name="bank_account" defaultValue={company?.bank_account ?? ""} placeholder="Bankszámlaszám" className={inputClass} />
      <input name="address" defaultValue={company?.address ?? ""} placeholder="Székhely" className={inputClass} />
    </div>
  );
}

export default async function FinanceCompaniesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("finance_companies")
    .select("id, name, tax_number, address, bank_account, color")
    .order("sort_order")
    .order("name");
  const companies = (data ?? []) as CompanyRow[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cégek"
        description="Azok a cégek, amelyeknek a számláit itt vezetitek. Minden számla és törzs egy céghez tartozik, és fent cégenként szűrhető minden nézet."
      />

      {companies.length === 0 && (
        <EmptyState
          icon={Building}
          title="Még nincs cég felvéve"
          description="Vedd fel először a cégeket (pl. Workerbase, Interprop, Bluegate) — utána rögzíthetők a számlák."
        />
      )}

      {companies.map((c) => (
        <Card key={c.id} className="p-4">
          <form action={saveCompany} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={c.id} />
            <CompanyFields company={c} />
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="secondary">
                Mentés
              </Button>
            </div>
          </form>
          <ConfirmDelete
            action={deleteCompany}
            fields={{ id: c.id }}
            label="Cég törlése"
            question="Csak tételek nélküli cég törölhető. Törlöd?"
          />
        </Card>
      ))}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Új cég</h2>
        <form action={saveCompany} className="flex flex-col gap-3">
          <CompanyFields />
          <div>
            <Button type="submit" size="sm">
              Cég hozzáadása
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

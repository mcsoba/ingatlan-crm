import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId, listCompanies } from "@/lib/companies";
import { PageHeader } from "@/components/ui/page-header";
import { LodgingForm } from "../../lodging-form";
import { loadPartnerNames } from "../../data";

export default async function NewLodgingPage() {
  const supabase = await createClient();
  const [companies, names, company] = await Promise.all([listCompanies(), loadPartnerNames(supabase), getSelectedCompanyId()]);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/lodgings" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a szállásokhoz
      </Link>
      <PageHeader
        title="Új szállás"
        description="Elég a címet megadni; a szerződések adatai később is pótolhatók. Mentés után egy gombbal készíthetsz belőle ismétlődő számlát."
      />
      <LodgingForm companies={companies} {...names} defaultCompanyId={company ?? undefined} />
    </div>
  );
}

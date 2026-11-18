import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "../../company-form";

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/companies" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a cégekhez
      </Link>
      <PageHeader title="Új cég" description="Elég a nevet megadni — a többi adat, a személyek és a dokumentumok később is pótolhatók." />
      <CompanyForm />
    </div>
  );
}

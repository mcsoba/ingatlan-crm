import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadFormOptions } from "../../data";
import { getSelectedCompanyId } from "@/lib/companies";
import { ScheduleForm } from "../../schedule-form";
import { PageHeader } from "@/components/ui/page-header";
import { linkClass } from "@/components/ui/styles";
import { todayIso } from "@/lib/finance";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const company = (await searchParams).company ?? (await getSelectedCompanyId()) ?? undefined;
  const supabase = await createClient();
  const options = await loadFormOptions(supabase);

  if (options.companies.length === 0) {
    return (
      <p className="text-sm text-muted">
        Előbb vegyél fel legalább egy céget a{" "}
        <Link href="/dashboard/finance/companies" className={linkClass}>
          Cégek
        </Link>{" "}
        fülön.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Új számla-törzs"
        description="Az ismétlődő számla adatai egyszer — a rendszer minden időszakra előkészíti a tételt, és jelez, mikor kell kiállítani."
      />
      <ScheduleForm {...options} defaultCompanyId={company} today={todayIso()} />
    </div>
  );
}

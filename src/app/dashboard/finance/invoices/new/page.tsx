import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadFormOptions } from "../../data";
import { getSelectedCompanyId } from "@/lib/companies";
import { InvoiceForm } from "../../invoice-form";
import { PageHeader } from "@/components/ui/page-header";
import { linkClass } from "@/components/ui/styles";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const company = sp.company ?? (await getSelectedCompanyId()) ?? undefined;
  const dir = sp.dir;
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
      <PageHeader title="Új tétel" description="Számla, díjbekérő vagy bizonylat nélküli pénzmozgás (bér, adó, bankköltség, készpénz, tagi kölcsön)." />
      <InvoiceForm
        {...options}
        defaultDirection={dir === "out" ? "out" : "in"}
        defaultCompanyId={company}
        returnTo={`/dashboard/finance/invoices${company ? `?company=${company}` : ""}`}
      />
    </div>
  );
}

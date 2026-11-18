import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PartnerForm } from "../../partner-form";

export default async function NewPartnerPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const role = (await searchParams).role;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/dashboard/finance/partners" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Vissza a partnerekhez
      </Link>
      <PageHeader title="Új partner" description="Elég a nevet megadni — a többi adat később is pótolható." />
      <PartnerForm defaultRole={role === "landlord" || role === "tenant" ? role : undefined} />
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { linkClass } from "@/components/ui/styles";
import { HelpContent } from "./help-content";

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Súgó"
        description="Gyakori kérdések a CRM funkcióiról — keress kulcsszóra, vagy görgesd végig a kategóriákat."
      />
      <p className="-mt-4 text-sm text-muted">
        Azt keresed, mi változott legutóbb?{" "}
        <Link href="/dashboard/whats-new" className={linkClass}>
          Nézd meg az Újdonságokat
        </Link>
        .
      </p>
      <HelpContent />
    </div>
  );
}

import { PageHeader } from "@/components/ui/page-header";
import { HelpContent } from "./help-content";

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Súgó"
        description="Gyakori kérdések a CRM funkcióiról — keress kulcsszóra, vagy görgesd végig a kategóriákat."
      />
      <HelpContent />
    </div>
  );
}

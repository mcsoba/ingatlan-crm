import Link from "next/link";
import { createProperty } from "../actions";
import { PropertyForm } from "../property-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Új ingatlan"
        action={
          <Link
            href="/dashboard/properties"
            className="text-sm text-muted hover:text-accent"
          >
            ← Ingatlanok
          </Link>
        }
      />
      <PropertyForm action={createProperty} submitLabel="Létrehozás" />
    </div>
  );
}

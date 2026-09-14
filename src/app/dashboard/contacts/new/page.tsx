import Link from "next/link";
import { createContact } from "../actions";
import { ContactForm } from "../contact-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Új kontakt"
        action={
          <Link
            href="/dashboard/contacts"
            className="text-sm text-muted hover:text-accent"
          >
            ← Kontaktok
          </Link>
        }
      />
      <ContactForm action={createContact} submitLabel="Létrehozás" />
    </div>
  );
}

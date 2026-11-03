import Link from "next/link";
import { createContact } from "../actions";
import { ContactForm } from "../contact-form";
import { PageHeader } from "@/components/ui/page-header";
import { ensureCurrentUserProfile } from "@/lib/agency";
import { listTeamMembers } from "@/lib/team";
import { listCompanies, getSelectedCompanyId } from "@/lib/companies";

export default async function NewContactPage() {
  const [{ profile }, teamMembers, companies, selectedCompanyId] = await Promise.all([
    ensureCurrentUserProfile(),
    listTeamMembers(),
    listCompanies(),
    getSelectedCompanyId(),
  ]);
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
      <ContactForm
        action={createContact}
        submitLabel="Létrehozás"
        teamMembers={teamMembers}
        currentUserId={profile.id}
        companies={companies}
        defaultCompanyId={selectedCompanyId}
      />
    </div>
  );
}

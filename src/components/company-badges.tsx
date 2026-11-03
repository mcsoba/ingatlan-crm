import { companyColor, pickCompanies, type Company } from "@/lib/company-shared";

/** Kis, színes cégcímkék (kontakt, üzlet, munkatárs mellett). */
export function CompanyBadges({
  companies,
  ids,
  className = "",
}: {
  companies: Company[];
  ids: (string | null | undefined)[] | null | undefined;
  className?: string;
}) {
  const picked = pickCompanies(companies, ids);
  if (picked.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {picked.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10.5px] font-medium text-muted"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: companyColor(companies, c.id) }} />
          {c.name}
        </span>
      ))}
    </span>
  );
}

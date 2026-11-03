import { companyColor, type Company } from "@/lib/company-shared";
import { fieldGroupClass, labelClass } from "@/components/ui/styles";

/**
 * Cég(ek) kiválasztása űrlapban. `multiple`: jelölőnégyzetek (`company_ids`
 * mezőnév, többször), különben legördülő (`company_id`). Cégek nélkül nem
 * jelenik meg — így a cég nélküli telepítésekben sem zavar.
 */
export function CompanyPicker({
  companies,
  multiple = false,
  defaultIds = [],
  label,
}: {
  companies: Company[];
  multiple?: boolean;
  defaultIds?: (string | null | undefined)[];
  label?: string;
}) {
  if (companies.length === 0) return null;
  const selected = new Set(defaultIds.filter(Boolean));

  if (!multiple) {
    return (
      <label className={fieldGroupClass}>
        <span className={labelClass}>{label ?? "Cég"}</span>
        <select
          name="company_id"
          defaultValue={[...selected][0] ?? ""}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          <option value="">Nincs megadva</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <fieldset className={fieldGroupClass}>
      <legend className={`${labelClass} mb-1.5`}>{label ?? "Cég(ek)"}</legend>
      {/* Üres jelölésnél is elküldjük, hogy a szerver tudja: a mező szerepelt az űrlapon */}
      <input type="hidden" name="company_ids_present" value="1" />
      <div className="flex flex-wrap gap-2">
        {companies.map((c) => (
          <label
            key={c.id}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input type="checkbox" name="company_ids" value={c.id} defaultChecked={selected.has(c.id)} className="sr-only" />
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: companyColor(companies, c.id) }} />
            {c.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}


import { saveCompanyPerson } from "./company-actions";
import { Button } from "@/components/ui/button";
import { fieldGroupClass, inputClass, labelClass } from "@/components/ui/styles";
import { COMPANY_PERSON_ROLES, COMPANY_PERSON_ROLE_LABELS, type CompanyPersonRow } from "@/lib/finance";

export type TeamMemberOption = { id: string; full_name: string | null };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`${fieldGroupClass} ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

/** Ügyvezető / tag / munkatárs / könyvelő felvétele vagy szerkesztése a cég adatlapján. */
export function CompanyPersonForm({
  companyId,
  person,
  members,
  defaultRole,
}: {
  companyId: string;
  person?: CompanyPersonRow;
  members: TeamMemberOption[];
  defaultRole?: CompanyPersonRow["role"];
}) {
  const p = person;
  return (
    <form action={saveCompanyPerson} className="flex flex-col gap-4">
      <input type="hidden" name="company_id" value={companyId} />
      {p && <input type="hidden" name="id" value={p.id} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Szerepe">
          <select name="role" defaultValue={p?.role ?? defaultRole ?? "employee"} className={inputClass}>
            {COMPANY_PERSON_ROLES.map((r) => (
              <option key={r} value={r}>
                {COMPANY_PERSON_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="CRM-felhasználó (ha van)">
          <select name="profile_id" defaultValue={p?.profile_id ?? ""} className={inputClass}>
            <option value="">— külsős, nincs CRM-fiókja —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || "Névtelen felhasználó"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Név" className="sm:col-span-2">
          <input name="name" defaultValue={p?.name ?? ""} placeholder="Üresen = a CRM-felhasználó neve" className={inputClass} />
        </Field>
        <Field label="Beosztás">
          <input name="position" defaultValue={p?.position ?? ""} placeholder="pl. értékesítési vezető" className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input type="email" name="email" defaultValue={p?.email ?? ""} className={inputClass} />
        </Field>
        <Field label="Telefon">
          <input type="tel" name="phone" defaultValue={p?.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="Tulajdoni hányad (%)">
          <input name="ownership_percent" inputMode="decimal" defaultValue={p?.ownership_percent ?? ""} placeholder="pl. 50" className={inputClass} />
        </Field>
        <Field label="Kezdés (kinevezés / belépés)">
          <input type="date" name="start_date" defaultValue={p?.start_date ?? ""} className={inputClass} />
        </Field>
        <Field label="Befejezés">
          <input type="date" name="end_date" defaultValue={p?.end_date ?? ""} className={inputClass} />
        </Field>
      </div>

      <details className="rounded-lg border border-border-subtle p-3" open={Boolean(p && (p.birth_date || p.mother_name || p.tax_id || p.address))}>
        <summary className="cursor-pointer text-xs font-medium text-muted">
          Személyes adatok (cégügyekhez, pl. ügyvezetőnél) — csak az irodavezetők látják
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Születési név">
            <input name="birth_name" defaultValue={p?.birth_name ?? ""} className={inputClass} />
          </Field>
          <Field label="Születési hely">
            <input name="birth_place" defaultValue={p?.birth_place ?? ""} className={inputClass} />
          </Field>
          <Field label="Születési idő">
            <input type="date" name="birth_date" defaultValue={p?.birth_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Anyja neve">
            <input name="mother_name" defaultValue={p?.mother_name ?? ""} className={inputClass} />
          </Field>
          <Field label="Lakcím">
            <input name="address" defaultValue={p?.address ?? ""} className={inputClass} />
          </Field>
          <Field label="Adóazonosító jel">
            <input name="tax_id" defaultValue={p?.tax_id ?? ""} className={inputClass} />
          </Field>
        </div>
      </details>

      <Field label="Megjegyzés">
        <textarea name="notes" rows={2} defaultValue={p?.notes ?? ""} className={inputClass} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="sm">
          {p ? "Mentés" : "Személy hozzáadása"}
        </Button>
      </div>
    </form>
  );
}

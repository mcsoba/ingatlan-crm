import { saveCompanyDetails } from "./company-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldGroupClass, inputClass, labelClass, sectionLabelClass } from "@/components/ui/styles";
import type { CompanyDetail } from "@/lib/finance";

function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`${fieldGroupClass} ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** A cég adatlapja — a „Worker Base info” Excel-lap cégadatai. Jelszó szándékosan nincs benne. */
export function CompanyForm({ company }: { company?: CompanyDetail }) {
  const c = company;
  return (
    <form action={saveCompanyDetails} className="flex flex-col gap-4">
      {c && <input type="hidden" name="id" value={c.id} />}

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Cégadatok</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cégnév *" className="sm:col-span-2">
            <input name="name" required defaultValue={c?.name} placeholder="pl. Bluegate Housing Kft." className={inputClass} />
          </Field>
          <Field label="Cégjegyzékszám">
            <input name="registration_number" defaultValue={c?.registration_number ?? ""} placeholder="09-09-000000" className={inputClass} />
          </Field>
          <Field label="Alapítás dátuma">
            <input type="date" name="founded_date" defaultValue={c?.founded_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Adószám">
            <input name="tax_number" defaultValue={c?.tax_number ?? ""} placeholder="12345678-2-09" className={inputClass} />
          </Field>
          <Field label="Közösségi adószám">
            <input name="eu_vat_number" defaultValue={c?.eu_vat_number ?? ""} placeholder="HU12345678" className={inputClass} />
          </Field>
          <Field label="Fő tevékenység (TEÁOR)" className="sm:col-span-2">
            <input name="main_activity" defaultValue={c?.main_activity ?? ""} placeholder="pl. 6820 Saját tulajdonú, bérelt ingatlan bérbeadása" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Címek</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Székhely">
            <input name="address" defaultValue={c?.address ?? ""} className={inputClass} />
          </Field>
          <Field label="Iroda / telephely" hint="Ha eltér a székhelytől">
            <input name="office_address" defaultValue={c?.office_address ?? ""} className={inputClass} />
          </Field>
          <Field label="Levelezési cím" hint="Ha eltér a székhelytől">
            <input name="mailing_address" defaultValue={c?.mailing_address ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Bank</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Bank neve">
            <input name="bank_name" defaultValue={c?.bank_name ?? ""} placeholder="pl. OTP Bank" className={inputClass} />
          </Field>
          <Field label="Bankszámlaszám">
            <input name="bank_account" defaultValue={c?.bank_account ?? ""} placeholder="11111111-22222222-33333333" className={inputClass} />
          </Field>
          <Field label="IBAN">
            <input name="iban" defaultValue={c?.iban ?? ""} placeholder="HU00 1111 …" className={inputClass} />
          </Field>
          <Field label="SWIFT / BIC">
            <input name="swift" defaultValue={c?.swift ?? ""} placeholder="OTPVHUHB" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Elérhetőség és egyéb</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="E-mail">
            <input type="email" name="email" defaultValue={c?.email ?? ""} className={inputClass} />
          </Field>
          <Field label="Telefon">
            <input type="tel" name="phone" defaultValue={c?.phone ?? ""} className={inputClass} />
          </Field>
          <Field label="Weboldal">
            <input name="website" defaultValue={c?.website ?? ""} placeholder="bghiroda.hu" className={inputClass} />
          </Field>
          <Field label="Szín" hint="A cég színe a címkéken és a szűrőben">
            <input type="color" name="color" defaultValue={c?.color ?? "#2e6ff2"} className="h-9 w-16 cursor-pointer rounded border border-border bg-surface" />
          </Field>
          <Field label="Könyvelő" className="sm:col-span-2" hint="Iroda / személy neve, elérhetősége">
            <input name="accountant" defaultValue={c?.accountant ?? ""} className={inputClass} />
          </Field>
          <Field label="Megjegyzés" className="sm:col-span-2">
            <textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Jelszavakat (ügyfélkapu, bank, tárhely stb.) ide ne írjatok — azokat jelszókezelőben tartsátok (pl. Bitwarden, 1Password).
        </p>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{c ? "Cégadatok mentése" : "Cég felvétele"}</Button>
      </div>
    </form>
  );
}

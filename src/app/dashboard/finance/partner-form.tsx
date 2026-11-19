import { savePartner } from "./partner-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldGroupClass, inputClass, labelClass, sectionLabelClass } from "@/components/ui/styles";
import type { PartnerRow } from "@/lib/finance";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className={fieldGroupClass}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function PartnerForm({ partner, defaultRole }: { partner?: PartnerRow; defaultRole?: "landlord" | "tenant" }) {
  return (
    <form action={savePartner} className="flex flex-col gap-4">
      {partner && <input type="hidden" name="id" value={partner.id} />}

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Alapadatok</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Név *">
            <input name="name" required defaultValue={partner?.name} placeholder="pl. Vágó Viktor / Bozhon Kft." className={inputClass} />
          </Field>
          <Field label="Típus" hint="Magánszemély bérbeadónál a bérleti díjból SZJA-t vonunk le">
            <select name="kind" defaultValue={partner?.kind ?? (defaultRole === "landlord" ? "person" : "company")} className={inputClass}>
              <option value="company">Cég</option>
              <option value="person">Magánszemély</option>
            </select>
          </Field>
          <div className={fieldGroupClass}>
            <span className={labelClass}>Szerepe</span>
            <div className="flex flex-wrap gap-4 pt-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_landlord" defaultChecked={partner ? partner.is_landlord : defaultRole === "landlord"} />
                Bérbeadó (tőle bérlünk)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_tenant" defaultChecked={partner ? partner.is_tenant : defaultRole === "tenant"} />
                Bérlő (neki adjuk tovább)
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Számlázási adatok</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Adószám / adóazonosító jel">
            <input name="tax_number" defaultValue={partner?.tax_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Bankszámlaszám">
            <input name="bank_account" defaultValue={partner?.bank_account ?? ""} className={inputClass} />
          </Field>
          <Field label="Cím / székhely">
            <input name="address" defaultValue={partner?.address ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Kapcsolattartó</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Név">
            <input name="contact_name" defaultValue={partner?.contact_name ?? ""} className={inputClass} />
          </Field>
          <Field label="E-mail">
            <input type="email" name="contact_email" defaultValue={partner?.contact_email ?? ""} className={inputClass} />
          </Field>
          <Field label="Telefon">
            <input type="tel" name="contact_phone" defaultValue={partner?.contact_phone ?? ""} className={inputClass} />
          </Field>
        </div>
        <Field label="Megjegyzés">
          <textarea name="notes" rows={2} defaultValue={partner?.notes ?? ""} className={inputClass} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{partner ? "Mentés" : "Partner felvétele"}</Button>
      </div>
    </form>
  );
}

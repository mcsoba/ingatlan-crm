"use client";

import { useState } from "react";
import { saveLodging } from "./partner-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldGroupClass, inputClass, labelClass, sectionLabelClass } from "@/components/ui/styles";
import {
  LEASE_FREQUENCY_LABELS,
  formatMoney,
  leaseEndFrom,
  monthlyEquivalent,
  parseAmount,
  type LeaseFrequency,
  type LodgingRow,
} from "@/lib/finance";

function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`${fieldGroupClass} ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

function amountText(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(Math.round(Number(n)));
}

/** Kezdet + időtartam (hónap) → vége; a vége kézzel is átírható. */
function ContractDates({
  prefix,
  start: initialStart,
  end: initialEnd,
}: {
  prefix: "lease" | "sublease";
  start: string | null | undefined;
  end: string | null | undefined;
}) {
  const [start, setStart] = useState(initialStart ?? "");
  const [end, setEnd] = useState(initialEnd ?? "");
  const [months, setMonths] = useState("");
  const apply = (s: string, m: string) => {
    const n = Number(m);
    if (s && Number.isInteger(n) && n > 0 && n <= 240) setEnd(leaseEndFrom(s, n));
  };
  return (
    <>
      <Field label="Szerződés kezdete">
        <input
          type="date"
          name={`${prefix}_start`}
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            apply(e.target.value, months);
          }}
          className={inputClass}
        />
      </Field>
      <Field label="Időtartam (hónap)" hint="Beírva kitölti a végét">
        <input
          inputMode="numeric"
          value={months}
          placeholder="pl. 12"
          onChange={(e) => {
            setMonths(e.target.value);
            apply(start, e.target.value);
          }}
          className={inputClass}
        />
      </Field>
      <Field label="Szerződés vége" hint="Üresen: határozatlan">
        <input type="date" name={`${prefix}_end`} min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
      </Field>
    </>
  );
}

export function LodgingForm({
  lodging,
  companies,
  landlords,
  tenants,
  defaultCompanyId,
  landlordName,
  tenantName,
}: {
  lodging?: LodgingRow;
  companies: { id: string; name: string }[];
  landlords: string[];
  tenants: string[];
  defaultCompanyId?: string;
  landlordName?: string;
  tenantName?: string;
}) {
  const [leaseFee, setLeaseFee] = useState(amountText(lodging?.lease_fee));
  const [leaseFreq, setLeaseFreq] = useState<LeaseFrequency>(lodging?.lease_frequency ?? "monthly");
  const [subFee, setSubFee] = useState(amountText(lodging?.sublease_fee));
  const [subFreq, setSubFreq] = useState<LeaseFrequency>(lodging?.sublease_frequency ?? "monthly");

  const leaseMonthly = monthlyEquivalent(parseAmount(leaseFee), leaseFreq);
  const subMonthly = monthlyEquivalent(parseAmount(subFee), subFreq);
  const margin = leaseMonthly !== null && subMonthly !== null ? subMonthly - leaseMonthly : null;

  return (
    <form action={saveLodging} className="flex flex-col gap-4">
      {lodging && <input type="hidden" name="id" value={lodging.id} />}

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>A szállás</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Pontos cím *" className="sm:col-span-2 lg:col-span-3">
            <input name="address" required defaultValue={lodging?.address} placeholder="pl. 4200 Hajdúszoboszló, Bányász utca 35." className={inputClass} />
          </Field>
          <Field label="Melyik cégünk" className="lg:col-span-1">
            <select name="company_id" defaultValue={lodging?.company_id ?? defaultCompanyId ?? companies[0]?.id ?? ""} className={inputClass}>
              <option value="">—</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alapterület (m²)">
            <input name="area_sqm" inputMode="decimal" defaultValue={lodging?.area_sqm ?? ""} className={inputClass} />
          </Field>
          <Field label="Férőhely (fő)">
            <input name="capacity" inputMode="numeric" defaultValue={lodging?.capacity ?? ""} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div>
          <div className={sectionLabelClass}>Bérlés — tőle béreljük</div>
          <p className="mt-1 text-xs text-muted">Ha új nevet írsz be, a rendszer magától felveszi a Partnerek közé — az adószámot, bankszámlát ott lehet pótolni.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Bérbeadó" className="sm:col-span-2">
            <input name="landlord_name" list="lodging-landlords" defaultValue={landlordName ?? ""} className={inputClass} />
            <datalist id="lodging-landlords">
              {landlords.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Szerződés aláírása">
            <input type="date" name="lease_signed_date" defaultValue={lodging?.lease_signed_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Birtokbaadás napja">
            <input type="date" name="lease_handover_date" defaultValue={lodging?.lease_handover_date ?? ""} className={inputClass} />
          </Field>
          <ContractDates prefix="lease" start={lodging?.lease_start} end={lodging?.lease_end} />
          <div />
          <Field label="Bérleti díj (bruttó)">
            <input name="lease_fee" inputMode="decimal" value={leaseFee} onChange={(e) => setLeaseFee(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Fizetés">
            <select name="lease_frequency" value={leaseFreq} onChange={(e) => setLeaseFreq(e.target.value as LeaseFrequency)} className={inputClass}>
              {Object.entries(LEASE_FREQUENCY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kaució (amit mi fizettünk)">
            <input name="lease_deposit" inputMode="decimal" defaultValue={amountText(lodging?.lease_deposit)} className={inputClass} />
          </Field>
          <Field label="Szerződés hosszabbítás">
            <input name="lease_extension" defaultValue={lodging?.lease_extension ?? ""} placeholder="pl. +6 hónappal, 2027.02.28-ig" className={inputClass} />
          </Field>
          <Field label="Mit tartalmaz a díj" className="sm:col-span-2">
            <input name="lease_includes" defaultValue={lodging?.lease_includes ?? ""} placeholder="pl. bérleti díj + közüzemi díjak külön" className={inputClass} />
          </Field>
          <Field label="Vállalások (a díj tartalmazza)" className="sm:col-span-2">
            <input name="lease_terms" defaultValue={lodging?.lease_terms ?? ""} placeholder="pl. internet, havi 1 takarítás, szemétszállítás" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Továbbadás — neki adjuk ki</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Bérlő (szerződött fél)" className="sm:col-span-2">
            <input name="tenant_name" list="lodging-tenants" defaultValue={tenantName ?? ""} className={inputClass} />
            <datalist id="lodging-tenants">
              {tenants.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Szerződés aláírása">
            <input type="date" name="sublease_signed_date" defaultValue={lodging?.sublease_signed_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Hány ember lakik ott">
            <input name="occupants" inputMode="numeric" defaultValue={lodging?.occupants ?? ""} className={inputClass} />
          </Field>
          <ContractDates prefix="sublease" start={lodging?.sublease_start} end={lodging?.sublease_end} />
          <div />
          <Field label="Díj, amit kiszámlázunk (bruttó)">
            <input name="sublease_fee" inputMode="decimal" value={subFee} onChange={(e) => setSubFee(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Számlázás">
            <select name="sublease_frequency" value={subFreq} onChange={(e) => setSubFreq(e.target.value as LeaseFrequency)} className={inputClass}>
              {Object.entries(LEASE_FREQUENCY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kaució (amit a bérlő fizet)">
            <input name="sublease_deposit" inputMode="decimal" defaultValue={amountText(lodging?.sublease_deposit)} className={inputClass} />
          </Field>
          <Field label="Mit tartalmaz">
            <input name="sublease_includes" defaultValue={lodging?.sublease_includes ?? ""} placeholder="pl. bérleti díj + továbbszámlázott rezsi" className={inputClass} />
          </Field>
        </div>
        {margin !== null && (
          <div className={`rounded-lg px-3 py-2 text-sm ${margin < 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
            Havi különbözet: <strong className="tabular-nums">{formatMoney(margin)}</strong>
            <span className="text-muted">
              {" "}
              (kiszámlázva {formatMoney(subMonthly)} / hó − bérleti díj {formatMoney(leaseMonthly)} / hó)
            </span>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <Field label="Megjegyzés">
          <textarea name="notes" rows={2} defaultValue={lodging?.notes ?? ""} placeholder="pl. 1/2 arányban fizetve a 2 tulaj között" className={inputClass} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{lodging ? "Mentés" : "Szállás felvétele"}</Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { saveSchedule } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldGroupClass, inputClass, labelClass, sectionLabelClass } from "@/components/ui/styles";
import {
  CATEGORIES,
  DOC_TYPE_LABELS,
  FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS,
  VAT_OPTIONS,
  computeGross,
  formatDate,
  formatMoney,
  parseAmount,
  previewOccurrences,
  szjaAmount,
  type Currency,
  type Direction,
  type Frequency,
  type ScheduleRow,
} from "@/lib/finance";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className={fieldGroupClass}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ScheduleForm({
  schedule,
  companies,
  properties,
  partners,
  defaultCompanyId,
  today,
  generatedCount,
}: {
  schedule?: ScheduleRow;
  companies: { id: string; name: string }[];
  properties: { id: string; address: string }[];
  partners: string[];
  defaultCompanyId?: string;
  today: string;
  generatedCount?: number;
}) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [direction, setDirection] = useState<Direction>(schedule?.direction ?? "out");
  const [currency, setCurrency] = useState<Currency>(schedule?.currency ?? "HUF");
  const [net, setNet] = useState(schedule ? String(Number(schedule.net_amount)).replace(".", ",") : "");
  const [rate, setRate] = useState(schedule ? (schedule.vat_rate === null ? "" : String(Number(schedule.vat_rate))) : "0");
  const [frequency, setFrequency] = useState<Frequency>(schedule?.frequency ?? "monthly");
  const [start, setStart] = useState(schedule?.start_date ?? "");
  const [end, setEnd] = useState(schedule?.end_date ?? "");
  const [issueDay, setIssueDay] = useState(String(schedule?.issue_day ?? 2));
  const [paymentDays, setPaymentDays] = useState(String(schedule?.payment_days ?? 8));
  const [prorate, setProrate] = useState(schedule?.prorate ?? true);
  const [szja, setSzja] = useState(schedule?.szja_withheld ?? false);
  const [location, setLocation] = useState(schedule?.location ?? "");
  // Új törzsnél régi szerződés esetén ne pótoljon visszamenőleg: alapból az aktuális hónaptól
  const [firstPeriod, setFirstPeriod] = useState("");

  const netNum = parseAmount(net) ?? 0;
  const vatRate = rate === "" ? null : Number(rate);
  const { gross } = computeGross(netNum, vatRate, currency);
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start);
  const timing = {
    frequency,
    start_date: start,
    end_date: end || null,
    issue_day: Math.min(28, Math.max(1, Number(issueDay) || 1)),
    payment_days: Math.max(0, Number(paymentDays) || 0),
    prorate,
    net_amount: netNum,
    currency,
  };
  // Régi kezdetű szerződésnél az aktuális hónapot tartalmazó (teljes) időszaktól indulunk
  const currentPeriodStart =
    validStart && start < monthStart
      ? (previewOccurrences(timing, start, 400).find((o) => o.periodEnd >= monthStart)?.periodStart ?? monthStart)
      : start;
  const effectiveFirst = firstPeriod || (schedule ? schedule.next_period_start : currentPeriodStart);

  const preview = validStart
    ? previewOccurrences(timing, effectiveFirst && effectiveFirst > start ? effectiveFirst : start, 4)
    : [];

  return (
    <form action={saveSchedule} className="flex flex-col gap-5">
      {schedule && <input type="hidden" name="id" value={schedule.id} />}

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Kinek, miről</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cég">
            <select name="company_id" required defaultValue={schedule?.company_id ?? defaultCompanyId ?? companies[0]?.id} className={inputClass}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Irány">
            <select name="direction" value={direction} onChange={(e) => setDirection(e.target.value as Direction)} className={inputClass}>
              <option value="out">Kimenő — mi számlázunk (pl. bérlőnek)</option>
              <option value="in">Bejövő — mi fizetünk (pl. bérbeadónak)</option>
            </select>
          </Field>
          <Field label="Bizonylat">
            <select name="doc_type" defaultValue={schedule?.doc_type ?? "invoice"} className={inputClass}>
              {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kategória">
            <select name="category" defaultValue={schedule?.category ?? "rent"} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={direction === "out" ? "Vevő" : "Bérbeadó / partner"}>
            <input name="counterparty_name" required list="schedule-partners" defaultValue={schedule?.counterparty_name} className={inputClass} />
            <datalist id="schedule-partners">
              {partners.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Partner adószáma">
            <input name="counterparty_tax_number" defaultValue={schedule?.counterparty_tax_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Ingatlan (opcionális)">
            <select
              name="property_id"
              defaultValue={schedule?.property_id ?? ""}
              onChange={(e) => {
                const p = properties.find((x) => x.id === e.target.value);
                if (p && !location) setLocation(p.address);
              }}
              className={inputClass}
            >
              <option value="">—</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Helyszín">
            <input name="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Számla tartalma">
          <input
            name="description"
            required
            defaultValue={schedule?.description ?? ""}
            placeholder="pl. ingatlan bérleti díj"
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Összeg</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Pénznem">
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={inputClass}>
              <option value="HUF">Forint (HUF)</option>
              <option value="EUR">Euró (EUR)</option>
            </select>
          </Field>
          <Field label={`Nettó / ${frequency === "quarterly" ? "negyedév" : frequency === "yearly" ? "év" : frequency === "once" ? "alkalom" : "hónap"}`}>
            <input name="net_amount" required inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} className={inputClass} />
          </Field>
          <Field label="ÁFA-kulcs">
            <select name="vat_rate" value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass}>
              {VAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fizetés módja">
            <select name="payment_method" defaultValue={schedule?.payment_method ?? "transfer"} className={inputClass}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-sm text-muted">
          Bruttó: <span className="font-medium text-foreground">{formatMoney(gross, currency)}</span>
          {direction === "in" && szja && <> · levont SZJA: {formatMoney(szjaAmount(gross, currency), currency)} · fizetendő: {formatMoney(gross - szjaAmount(gross, currency), currency)}</>}
        </p>
        {direction === "in" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="szja_withheld" checked={szja} onChange={(e) => setSzja(e.target.checked)} />
            Magánszemély bérbeadó — SZJA-levonás (a díj 90%-ának 15%-a)
          </label>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Időzítés</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Gyakoriság">
            <select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={inputClass}>
              {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label={frequency === "once" ? "Számlázás napja" : "Szerződés / számlázás kezdete"}>
            <input type="date" name="start_date" required value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          </Field>
          <Field label={frequency === "once" ? "Időszak vége (opcionális)" : "Vége (opcionális)"} hint={frequency === "once" ? undefined : "Üresen: határozatlan ideig"}>
            <input type="date" name="end_date" min={start || undefined} value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          </Field>
          {frequency !== "once" && (
            <Field label="Kiállítás napja" hint="A hónap hányadik napján kell számlázni">
              <input type="number" name="issue_day" min={1} max={28} value={issueDay} onChange={(e) => setIssueDay(e.target.value)} className={inputClass} />
            </Field>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fizetési határidő (nap)" hint="A kiállítástól számítva">
            <input type="number" name="payment_days" min={0} max={120} value={paymentDays} onChange={(e) => setPaymentDays(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Előre jelzés (nap)" hint="Ennyivel a kiállítás előtt jelenik meg a „Számlázandó” listán">
            <input type="number" name="lead_days" min={0} max={60} defaultValue={schedule?.lead_days ?? 7} className={inputClass} />
          </Field>
          <Field
            label={schedule ? "Generálás újraindítása ettől" : "Első létrehozandó időszak"}
            hint={
              schedule
                ? `Következő: ${formatDate(schedule.next_period_start)} — csak akkor írd át, ha máshonnan kell folytatni`
                : "Régi szerződésnél ne pótolja a múltbeli hónapokat"
            }
          >
            <input
              type="date"
              value={firstPeriod || (schedule ? "" : effectiveFirst)}
              onChange={(e) => setFirstPeriod(e.target.value)}
              className={inputClass}
            />
            {/* Szerkesztésnél csak a kifejezetten megadott érték megy el (különben marad a kurzor) */}
            <input type="hidden" name="first_period" value={schedule ? firstPeriod : effectiveFirst} />
          </Field>
          {frequency !== "once" && (
            <label className="flex items-start gap-2 pt-6 text-sm">
              <input type="checkbox" name="prorate" checked={prorate} onChange={(e) => setProrate(e.target.checked)} className="mt-0.5" />
              <span>
                Törthavi arányosítás
                <span className="block text-xs text-muted">Hó közben induló / záruló időszak a napok arányában</span>
              </span>
            </label>
          )}
        </div>

        {preview.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 text-xs font-medium text-muted">Következő esedékességek (előnézet)</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 font-medium">Időszak</th>
                  <th className="py-1 font-medium">Kiállítás</th>
                  <th className="py-1 font-medium">Határidő</th>
                  <th className="py-1 text-right font-medium">Nettó</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((o) => (
                  <tr key={o.periodStart} className="tabular-nums">
                    <td className="py-1">
                      {formatDate(o.periodStart)}–{formatDate(o.periodEnd)}
                      {o.ratio < 1 && <span className="ml-1 text-xs text-warning">törthavi {Math.round(o.ratio * 100)}%</span>}
                    </td>
                    <td className="py-1">{formatDate(o.issueDate)}</td>
                    <td className="py-1">{formatDate(o.dueDate)}</td>
                    <td className="py-1 text-right">{formatMoney(o.net, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Field label="Megjegyzés">
          <textarea name="notes" rows={2} defaultValue={schedule?.notes ?? ""} className={inputClass} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {schedule && generatedCount !== undefined && generatedCount > 0 && (
          <span className="text-xs text-muted">A már létrehozott {generatedCount} tételt a módosítás nem írja át — azok egyenként szerkeszthetők.</span>
        )}
        <Button type="submit">{schedule ? "Törzs mentése" : "Törzs létrehozása"}</Button>
      </div>
    </form>
  );
}

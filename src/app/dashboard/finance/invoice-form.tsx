"use client";

import { useState } from "react";
import { saveInvoice } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldGroupClass, inputClass, labelClass, sectionLabelClass } from "@/components/ui/styles";
import {
  CATEGORIES,
  DOC_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  VAT_OPTIONS,
  computeGross,
  formatMoney,
  parseAmount,
  roundMoney,
  szjaAmount,
  type Currency,
  type Direction,
  type InvoiceRow,
} from "@/lib/finance";

type Option = { id: string; name: string };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className={fieldGroupClass}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

function amountText(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(n).replace(".", ",");
}

export function InvoiceForm({
  invoice,
  companies,
  properties,
  partners,
  defaultDirection,
  defaultCompanyId,
  returnTo,
}: {
  invoice?: InvoiceRow;
  companies: Option[];
  properties: { id: string; address: string }[];
  partners: string[];
  defaultDirection: Direction;
  defaultCompanyId?: string;
  returnTo: string;
}) {
  const [direction, setDirection] = useState<Direction>(invoice?.direction ?? defaultDirection);
  const [currency, setCurrency] = useState<Currency>(invoice?.currency ?? "HUF");
  const [net, setNet] = useState(amountText(invoice?.net_amount));
  const [rate, setRate] = useState(
    invoice ? (invoice.vat_rate === null ? "" : String(Number(invoice.vat_rate))) : direction === "out" ? "0" : "27",
  );
  // A bruttó addig számolódik, amíg kézzel át nem írják
  const [grossOverride, setGrossOverride] = useState<string | null>(
    invoice && Number(invoice.gross_amount) !== computeGross(Number(invoice.net_amount), invoice.vat_rate, invoice.currency).gross
      ? amountText(invoice.gross_amount)
      : null,
  );
  const [szja, setSzja] = useState(invoice?.szja_withheld ?? false);
  const [location, setLocation] = useState(invoice?.location ?? "");

  const netNum = parseAmount(net) ?? 0;
  const computed = computeGross(roundMoney(netNum, currency), rate === "" ? null : Number(rate), currency);
  const grossNum = grossOverride !== null ? (parseAmount(grossOverride) ?? 0) : computed.gross;
  const withheld = direction === "in" && szja ? szjaAmount(grossNum, currency) : 0;

  return (
    <form action={saveInvoice} className="flex flex-col gap-5">
      {invoice && <input type="hidden" name="id" value={invoice.id} />}
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="is_planned" value={invoice?.is_planned ? "1" : "0"} />

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Alapadatok</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cég">
            <select name="company_id" required defaultValue={invoice?.company_id ?? defaultCompanyId ?? companies[0]?.id} className={inputClass}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Irány">
            <select
              name="direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
              className={inputClass}
            >
              <option value="out">Kimenő — mi számlázunk (bevétel)</option>
              <option value="in">Bejövő — nekünk számláznak (kiadás)</option>
            </select>
          </Field>
          <Field label="Bizonylat">
            <select name="doc_type" defaultValue={invoice?.doc_type ?? "invoice"} className={inputClass}>
              {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kategória">
            <select name="category" defaultValue={invoice?.category ?? (direction === "out" ? "rent" : "other")} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={direction === "out" ? "Vevő (számla címzettje)" : "Kiállító / partner"}>
            <input
              name="counterparty_name"
              required
              list="finance-partners"
              defaultValue={invoice?.counterparty_name}
              className={inputClass}
            />
            <datalist id="finance-partners">
              {partners.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Partner adószáma">
            <input name="counterparty_tax_number" defaultValue={invoice?.counterparty_tax_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Számlaszám" hint={invoice?.is_planned ? "Kiállítás után írd be — ezzel kerül ki a „Számlázandó” listából" : undefined}>
            <input name="invoice_number" defaultValue={invoice?.invoice_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Ingatlan (opcionális)">
            <select
              name="property_id"
              defaultValue={invoice?.property_id ?? ""}
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Számla tartalma">
            <input
              name="description"
              required
              defaultValue={invoice?.description}
              placeholder="pl. ingatlan bérleti díj, továbbszámlázott rezsi, takarítószerek"
              className={inputClass}
            />
          </Field>
          <Field label="Helyszín">
            <input name="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Dátumok</div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Időszak kezdete">
            <input type="date" name="period_start" defaultValue={invoice?.period_start ?? ""} className={inputClass} />
          </Field>
          <Field label="Időszak vége">
            <input type="date" name="period_end" defaultValue={invoice?.period_end ?? ""} className={inputClass} />
          </Field>
          <Field label="Kelte / dátum">
            <input type="date" name="issue_date" required defaultValue={invoice?.issue_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Teljesítés">
            <input type="date" name="fulfillment_date" defaultValue={invoice?.fulfillment_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Fizetési határidő">
            <input type="date" name="due_date" defaultValue={invoice?.due_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Fizetés módja">
            <select name="payment_method" defaultValue={invoice?.payment_method ?? "transfer"} className={inputClass}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Összeg</div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Pénznem">
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={inputClass}>
              <option value="HUF">Forint (HUF)</option>
              <option value="EUR">Euró (EUR)</option>
            </select>
          </Field>
          <Field label="Nettó">
            <input name="net_amount" inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} className={inputClass} />
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
          <Field label="ÁFA">
            <input disabled value={formatMoney(grossNum - roundMoney(netNum, currency), currency)} className={`${inputClass} opacity-70`} />
          </Field>
          <Field label="Bruttó" hint={grossOverride !== null ? "Kézzel megadva" : "Automatikusan számolva — átírható"}>
            <input
              name="gross_amount"
              inputMode="decimal"
              value={grossOverride ?? amountText(computed.gross)}
              onChange={(e) => setGrossOverride(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        {direction === "in" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="szja_withheld"
              checked={szja}
              onChange={(e) => setSzja(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Magánszemély bérbeadó — SZJA-levonás (a díj 90%-ának 15%-a)
              {szja && (
                <span className="block text-xs text-muted">
                  Levont SZJA: {formatMoney(withheld, currency)} · Ténylegesen fizetendő: {formatMoney(grossNum - withheld, currency)}
                </span>
              )}
            </span>
          </label>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className={sectionLabelClass}>Kifizetés és könyvelés</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={direction === "out" ? "Kiegyenlítés dátuma" : "Kifizetés dátuma"}>
            <input type="date" name="paid_date" defaultValue={invoice?.paid_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Ténylegesen fizetett összeg" hint="Üresen hagyva a fizetendő összeg számít">
            <input name="paid_amount" inputMode="decimal" defaultValue={amountText(invoice?.paid_amount)} className={inputClass} />
          </Field>
          <Field label="Bank könyvelés dátuma" hint="A bankszámlakivonat alapján">
            <input type="date" name="bank_booked_date" defaultValue={invoice?.bank_booked_date ?? ""} className={inputClass} />
          </Field>
        </div>
        <Field label="Megjegyzés">
          <textarea name="notes" rows={2} defaultValue={invoice?.notes ?? ""} className={inputClass} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">{invoice ? "Mentés" : "Tétel rögzítése"}</Button>
      </div>
    </form>
  );
}

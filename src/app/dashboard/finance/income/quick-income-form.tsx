"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createQuickIncome } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";
import { INCOME_CATEGORY_VALUES, PAYMENT_METHOD_LABELS, categoryLabel } from "@/lib/finance";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-muted ${className}`}>
      {label}
      {children}
    </label>
  );
}

/** Befolyt pénz pár mezővel — számla nélkül is (készpénzes bérleti díj, kaució, jutalék). */
export function QuickIncomeForm({
  companies,
  defaultCompanyId,
  partners,
  today,
}: {
  companies: { id: string; name: string }[];
  defaultCompanyId?: string | null;
  partners: string[];
  today: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [received, setReceived] = useState(true);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    const fd = new FormData(e.currentTarget);
    try {
      await createQuickIncome(fd);
      setSaved(`Rögzítve: ${fd.get("counterparty_name")} — ${fd.get("description")}`);
      // Cég, dátum, mód marad (sorozatos rögzítéshez), a többi ürül
      for (const name of ["description", "counterparty_name", "gross_amount", "invoice_number", "notes", "due_date", "paid_date"]) {
        const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
        if (el) el.value = "";
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <form ref={formRef} onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Kitől? *">
            <input name="counterparty_name" required list="income-partners" placeholder="pl. bérlő cég, ügyfél neve" className={inputClass} />
            <datalist id="income-partners">
              {partners.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Mi után? *" className="sm:col-span-2">
            <input name="description" required placeholder="pl. novemberi bérleti díj, kaució, jutalék" className={inputClass} />
          </Field>
          <Field label="Összeg *">
            <div className="flex gap-1.5">
              <input name="gross_amount" required inputMode="decimal" placeholder="0" className={`${inputClass} min-w-0 flex-1`} />
              <select name="currency" defaultValue="HUF" className={`${inputClass} w-20 px-2`}>
                <option value="HUF">Ft</option>
                <option value="EUR">€</option>
              </select>
            </div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Melyik cégünkhöz">
            <select name="company_id" required defaultValue={defaultCompanyId ?? companies[0]?.id} className={inputClass}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kategória">
            <select name="category" defaultValue="rent" className={inputClass}>
              {INCOME_CATEGORY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {categoryLabel(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hogyan jött">
            <select name="payment_method" defaultValue="transfer" className={inputClass}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Számlaszám (ha volt számla)">
            <input name="invoice_number" placeholder="pl. WRKR-2026-227" className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dátum">
            <input type="date" name="issue_date" defaultValue={today} className={inputClass} />
          </Field>
          <Field label="Megérkezett?">
            <select
              name="received"
              value={received ? "yes" : "no"}
              onChange={(e) => setReceived(e.target.value === "yes")}
              className={`${inputClass} ${received ? "text-success" : "text-danger"}`}
            >
              <option value="yes">✓ Igen, megkaptuk</option>
              <option value="no">✗ Még nem, várjuk</option>
            </select>
          </Field>
          {received ? (
            <Field label="Megérkezés napja">
              <input type="date" name="paid_date" className={inputClass} />
              <span className="text-[11px] text-muted-subtle">Üresen = a dátum</span>
            </Field>
          ) : (
            <Field label="Mikorra várjuk">
              <input type="date" name="due_date" className={inputClass} />
              <span className="text-[11px] text-muted-subtle">Üresen = a dátum</span>
            </Field>
          )}
          <Field label="Megjegyzés (opcionális)">
            <input name="notes" placeholder="pl. melyik szállás, ki vette át" className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <Check className="h-3.5 w-3.5" />
              {saved}
            </span>
          )}
          {error && <span className="text-xs text-danger">{error}</span>}
          <Button type="submit" disabled={busy}>
            {busy ? "Mentés…" : "Bevétel rögzítése"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check } from "lucide-react";
import { createQuickExpense } from "../actions";
import { uploadReceipt } from "../receipt-upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";
import { EXPENSE_CATEGORY_VALUES, PAYMENT_METHOD_LABELS, categoryLabel } from "@/lib/finance";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-muted ${className}`}>
      {label}
      {children}
    </label>
  );
}

/** Egy kiadás pár mezővel + blokkfotó — a részletes számlaűrlap csak valódi számlánál kell. */
export function QuickExpenseForm({
  agencyId,
  companies,
  defaultCompanyId,
  partners,
  today,
}: {
  agencyId: string;
  companies: { id: string; name: string }[];
  defaultCompanyId?: string | null;
  partners: string[];
  today: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    const fd = new FormData(e.currentTarget);
    try {
      const id = await createQuickExpense(fd);
      let receiptError = "";
      for (const f of files) {
        try {
          await uploadReceipt(agencyId, id, f);
        } catch {
          receiptError = " — a blokkot nem sikerült feltölteni, az adatlapon pótolható";
        }
      }
      setSaved(`Rögzítve: ${fd.get("description")}${receiptError}`);
      // Cég, dátum és fizetési mód marad (sorozatos rögzítéshez), a többi ürül
      for (const name of ["description", "counterparty_name", "gross_amount", "invoice_number", "notes"]) {
        const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
        if (el) el.value = "";
      }
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
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
          <Field label="Mire? *" className="sm:col-span-2">
            <input name="description" required placeholder="pl. tisztítószerek, üzemanyag, irodaszer" className={inputClass} />
          </Field>
          <Field label="Hol / kitől (opcionális)">
            <input name="counterparty_name" list="expense-partners" placeholder="pl. Tesco, MOL" className={inputClass} />
            <datalist id="expense-partners">
              {partners.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label="Összeg (bruttó) *">
            <div className="flex gap-1.5">
              <input name="gross_amount" required inputMode="decimal" placeholder="0" className={`${inputClass} min-w-0 flex-1`} />
              <select name="currency" defaultValue="HUF" className={`${inputClass} w-20 px-2`}>
                <option value="HUF">Ft</option>
                <option value="EUR">€</option>
              </select>
            </div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Cég">
            <select name="company_id" required defaultValue={defaultCompanyId ?? companies[0]?.id} className={inputClass}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dátum">
            <input type="date" name="issue_date" defaultValue={today} className={inputClass} />
          </Field>
          <Field label="Kategória">
            <select name="category" defaultValue="supplies" className={inputClass}>
              {EXPENSE_CATEGORY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {categoryLabel(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fizetés módja">
            <select name="payment_method" defaultValue="card" className={inputClass}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Számlaszám (ha van)">
            <input name="invoice_number" className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent"
          >
            <Camera className="h-4 w-4" />
            {files.length ? `${files.length} fájl kiválasztva` : "Blokk / számla fotója"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paid" defaultChecked />
            Már ki van fizetve
          </label>
          <div className="ml-auto flex items-center gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Check className="h-3.5 w-3.5" />
                {saved}
              </span>
            )}
            {error && <span className="text-xs text-danger">{error}</span>}
            <Button type="submit" disabled={busy}>
              {busy ? "Mentés…" : "Kiadás rögzítése"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

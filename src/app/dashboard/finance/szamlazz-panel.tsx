"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Zap } from "lucide-react";
import { markInvoice } from "./actions";
import { issueSzamlazzInvoice, releaseSzamlazzLock, type SzamlazzActionState } from "./szamlazz-actions";
import { SZAMLAZZ_VAT_CODES } from "@/lib/szamlazz";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/styles";

export type SzamlazzAuto = {
  companyName: string;
  eInvoice: boolean;
  locked: boolean;
  docLabel: "számla" | "díjbekérő";
  grossText: string;
  defaults: {
    buyerName: string;
    zip: string;
    city: string;
    street: string;
    taxNumber: string;
    email: string;
    isPerson: boolean;
    vatCode: string;
  };
};

/**
 * Kimenő tétel kiállítása. Ha a cégnél be van állítva a Számlázz.hu Agent-kulcs,
 * egy gombnyomással a CRM állítja ki (számlaszám + PDF vissza); különben — és
 * tartalékként mindig — a mezőnként másolható adatok és a számlaszám kézi visszaírása.
 */
export function SzamlazzPanel({
  invoiceId,
  fields,
  today,
  back,
  auto,
  showSetupHint,
  companyId,
}: {
  invoiceId: string;
  fields: { label: string; value: string }[];
  today: string;
  back: string;
  auto: SzamlazzAuto | null;
  showSetupHint: boolean;
  companyId: string;
}) {
  return (
    <Card className="flex flex-col gap-3 border-accent/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Kiállítás a Számlázz.hu-n</h2>
        <a
          href="https://www.szamlazz.hu/szamla/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Számlázz.hu megnyitása
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {auto ? (
        auto.locked ? (
          <LockedNotice invoiceId={invoiceId} />
        ) : (
          <AutoIssueForm invoiceId={invoiceId} back={back} auto={auto} />
        )
      ) : showSetupHint ? (
        <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted">
          <Zap className="mr-1 inline h-3.5 w-3.5 text-accent" />
          Egy kattintással is kiállíthatod innen, ha a cégnél megadod a Számlázz.hu Agent-kulcsot:{" "}
          <Link href={`/dashboard/finance/companies/${companyId}#szamlazz`} className="text-accent hover:underline">
            beállítás a cég adatlapján
          </Link>
          .
        </p>
      ) : null}

      <details className="rounded-lg border border-border-subtle" open={!auto}>
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
          {auto
            ? "Kézi kiállítás (adatok másolása, számlaszám visszaírása)"
            : "1. Másold át az adatokat mezőnként · 2. Készítsd el a számlát · 3. Írd be ide a kapott számlaszámot."}
        </summary>
        <div className="flex flex-col gap-3 border-t border-border-subtle p-3">
          <CopyFields fields={fields} />
          <form action={markInvoice} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={invoiceId} />
            <input type="hidden" name="action" value="issued" />
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
              Kapott számlaszám
              <input name="invoice_number" required placeholder="pl. WRKR-2026-227" className={`${inputClass} py-1.5`} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Kelte
              <input type="date" name="date" defaultValue={today} className={`${inputClass} py-1.5`} />
            </label>
            <Button type="submit" size="sm" variant={auto ? "secondary" : "primary"}>
              Kiállítva
            </Button>
          </form>
        </div>
      </details>
    </Card>
  );
}

function CopyFields({ fields }: { fields: { label: string; value: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      // Vágólap nem elérhető (pl. nem biztonságos környezet) — a mező kijelölhető kézzel
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border">
      {fields
        .filter((f) => f.value)
        .map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => copy(f.label, f.value)}
            className="flex items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-background"
          >
            <span className="w-28 shrink-0 text-xs text-muted">{f.label}</span>
            <span className="min-w-0 flex-1 break-words font-medium text-foreground">{f.value}</span>
            {copied === f.label ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Copy className="h-4 w-4 shrink-0 text-muted-subtle" />}
          </button>
        ))}
    </div>
  );
}

function SubmitIssue({ docLabel }: { docLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
      {pending ? "Kiállítás folyamatban…" : `Igen, kiállítom (${docLabel})`}
    </Button>
  );
}

function AutoIssueForm({ invoiceId, back, auto }: { invoiceId: string; back: string; auto: SzamlazzAuto }) {
  const [state, action] = useActionState<SzamlazzActionState, FormData>(issueSzamlazzInvoice, { status: "idle" });
  const [confirming, setConfirming] = useState(false);
  const d = auto.defaults;
  const field = `${inputClass} py-1.5`;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={invoiceId} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="buyer_is_person" value={d.isPerson ? "1" : "0"} />
      <p className="text-xs text-muted">
        Ellenőrizd a vevő adatait. A {auto.docLabel} a(z) <strong className="text-foreground">{auto.companyName}</strong> Számlázz.hu-fiókjában
        készül{auto.eInvoice ? " e-számlaként" : ""}, a számlaszám és a PDF automatikusan visszakerül ide.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Vevő neve
          <input name="buyer_name" required defaultValue={d.buyerName} className={field} />
        </label>
        <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:col-span-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Irányítószám
            <input name="zip" required inputMode="numeric" pattern="\d{4}" maxLength={4} defaultValue={d.zip} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Település
            <input name="city" required defaultValue={d.city} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Utca, házszám
          <input name="street" required defaultValue={d.street} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Adószám{d.isPerson ? " (magánszemélynél üres)" : ""}
          <input name="tax_number" defaultValue={d.taxNumber} placeholder="12345678-1-23" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          ÁFA
          <select name="vat_code" defaultValue={d.vatCode} className={field}>
            {SZAMLAZZ_VAT_CODES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Vevő e-mail-címe
          <input name="email" type="email" defaultValue={d.email} className={field} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-xs text-foreground">
          <input type="checkbox" name="send_email" />
          Küldje el a Számlázz.hu e-mailben
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Megjegyzés a számlán (nem kötelező)
          <input name="note" className={field} />
        </label>
      </div>

      {state.status === "error" && (
        <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-background p-3">
          <p className="text-sm text-foreground">
            Valódi {auto.docLabel} készül <strong>{auto.grossText}</strong> összegben
            {auto.docLabel === "számla" ? ", és a Számlázz.hu jelenti a NAV-nak. Utólag csak sztornózni lehet." : "."}
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitIssue docLabel={auto.docLabel} />
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Mégse
            </Button>
          </div>
        </div>
      ) : (
        <Button className="w-fit" onClick={() => setConfirming(true)}>
          <Zap className="h-4 w-4" />
          {auto.docLabel === "számla" ? "Számla kiállítása" : "Díjbekérő kiállítása"}
        </Button>
      )}
    </form>
  );
}

function LockedNotice({ invoiceId }: { invoiceId: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-background p-3 text-sm">
      <p className="flex items-start gap-1.5 text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        Egy korábbi kiállítás nem fejeződött be (nem jött válasz a Számlázz.hu-tól). Nézd meg a Számlázz.hu-n, elkészült-e a számla.
      </p>
      <ul className="ml-6 list-disc text-xs text-muted">
        <li>Ha elkészült: írd be a számlaszámot lent a kézi részben („Kiállítva”).</li>
        <li>Ha nem készült el: oldd fel, és próbáld újra.</li>
      </ul>
      <form action={releaseSzamlazzLock}>
        <input type="hidden" name="id" value={invoiceId} />
        <Button type="submit" size="sm" variant="secondary">
          Nem készült el — feloldás
        </Button>
      </form>
    </div>
  );
}

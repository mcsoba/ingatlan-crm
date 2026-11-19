"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Check, ExternalLink, KeyRound, Loader2, PlugZap } from "lucide-react";
import { removeSzamlazzSettings, saveSzamlazzSettings, testSzamlazzKey, type SzamlazzActionState } from "./szamlazz-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inputClass } from "@/components/ui/styles";

type Settings = { key_hint: string | null; invoice_prefix: string | null; e_invoice: boolean } | null;

function Message({ state }: { state: SzamlazzActionState }) {
  if (state.status === "idle" || !state.message) return null;
  const ok = state.status === "ok";
  return (
    <p className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-sm ${ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      {state.message}
    </p>
  );
}

function Submit({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
}

/** Cég adatlapja: Számlázz.hu Agent-kulcs és számlázási beállítások. A kulcs soha nem jön vissza a böngészőbe. */
export function SzamlazzSettingsCard({ companyId, settings, migrationMissing }: { companyId: string; settings: Settings; migrationMissing: boolean }) {
  const [saveState, saveAction] = useActionState<SzamlazzActionState, FormData>(saveSzamlazzSettings, { status: "idle" });
  const [testState, testAction] = useActionState<SzamlazzActionState, FormData>(testSzamlazzKey, { status: "idle" });
  const field = `${inputClass} py-1.5`;

  return (
    <Card id="szamlazz" className="flex scroll-mt-4 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Számlázz.hu összekötés
            {settings ? <Badge variant="success">Összekötve</Badge> : <Badge variant="neutral">Nincs beállítva</Badge>}
          </h2>
          <p className="text-xs text-muted">
            Ha megadod a cég Számla Agent-kulcsát, a kiállítandó számlákat és díjbekérőket egy kattintással a CRM-ből állíthatod ki: a
            számlaszám és a PDF automatikusan visszakerül a tételhez, nem kell semmit átmásolni.
          </p>
        </div>
        <a
          href="https://tudastar.szamlazz.hu/en/gyik/kulcs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Hogyan kérek Agent-kulcsot?
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {migrationMissing ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-foreground">
          Ehhez egy adatbázis-frissítés kell: futtasd le a <code>supabase/migrations/0048_szamlazz_agent.sql</code> fájlt a Supabase SQL Editorban.
        </p>
      ) : (
        <>
          {!settings && (
            <ol className="ml-5 list-decimal text-xs text-muted">
              <li>Lépj be a cég Számlázz.hu-fiókjába → Beállítások → <strong>Számla Agent kulcsok</strong> → Új kulcs.</li>
              <li>Másold ki a kulcsot, és illeszd be ide. (Ne küldd el e-mailben vagy chatben.)</li>
              <li>Mentés után nyomd meg a „Kapcsolat ellenőrzése” gombot.</li>
            </ol>
          )}
          <form action={saveAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="company_id" value={companyId} />
            <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" />
                Agent-kulcs {settings?.key_hint ? `(elmentve, vége: …${settings.key_hint} — üresen hagyva megmarad)` : ""}
              </span>
              <input
                name="agent_key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required={!settings}
                placeholder={settings ? "Új kulcs, ha cserélnéd" : "Illeszd be a kulcsot"}
                className={`${field} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Számlaszám-előtag (nem kötelező)
              <input name="invoice_prefix" defaultValue={settings?.invoice_prefix ?? ""} placeholder="pl. WRKR" maxLength={10} className={`${field} uppercase`} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs text-foreground">
              <input type="checkbox" name="e_invoice" defaultChecked={settings?.e_invoice ?? true} />
              E-számla (hiteles PDF, nem kell kinyomtatni)
            </label>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Message state={saveState} />
              <div>
                <Submit>{settings ? "Beállítások mentése" : "Kulcs mentése"}</Submit>
              </div>
            </div>
          </form>

          {settings && (
            <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
              <Message state={testState} />
              <div className="flex flex-wrap gap-2">
                <form action={testAction}>
                  <input type="hidden" name="company_id" value={companyId} />
                  <Submit variant="secondary">
                    <PlugZap className="h-3.5 w-3.5" />
                    Kapcsolat ellenőrzése
                  </Submit>
                </form>
                <form action={removeSzamlazzSettings}>
                  <input type="hidden" name="company_id" value={companyId} />
                  <Button type="submit" size="sm" variant="danger">
                    Összekötés megszüntetése
                  </Button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

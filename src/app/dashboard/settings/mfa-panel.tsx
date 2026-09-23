"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

type Factor = { id: string; friendly_name?: string | null };

export function MfaPanel({ initialFactor }: { initialFactor: Factor | null }) {
  const supabase = createClient();
  const [factor, setFactor] = useState<Factor | null>(initialFactor);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) {
      const verified = data?.totp?.find((f) => f.status === "verified") ?? null;
      setFactor(verified ?? null);
    }
  }

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyEnroll() {
    if (!enrollment) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError("Hibás kód — ellenőrizd, és próbáld újra.");
      return;
    }
    setEnrollment(null);
    setCode("");
    await refresh();
  }

  async function cancelEnroll() {
    if (enrollment) {
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    }
    setEnrollment(null);
    setCode("");
    setError(null);
  }

  async function removeFactor() {
    if (!factor) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    setConfirmRemove(false);
    await refresh();
  }

  if (enrollment) {
    return (
      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted">
          Olvasd be a QR-kódot egy authenticator-alkalmazással (pl. Google Authenticator,
          1Password), vagy add meg kézzel a titkos kulcsot, majd írd be a generált 6 jegyű
          kódot.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrollment.qrCode}
          alt="TOTP QR-kód"
          className="h-40 w-40 self-start rounded-lg border border-border bg-white p-2"
        />
        <p className="break-all text-xs text-muted-subtle">
          Kulcs: <code className="font-mono">{enrollment.secret}</code>
        </p>
        <div className={fieldGroupClass}>
          <span className={labelClass}>Megerősítő kód</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            className={`${inputClass} max-w-[10rem]`}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={verifyEnroll}
            disabled={busy || code.trim().length < 6}
          >
            Megerősítés
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEnroll} disabled={busy}>
            Mégse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        {factor ? (
          <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.75} />
        ) : (
          <ShieldOff className="h-4 w-4 text-muted-subtle" strokeWidth={1.75} />
        )}
        <div>
          <div className="text-sm text-foreground">Kétfaktoros hitelesítés</div>
          <div className="text-xs text-muted">
            {factor
              ? "Bekapcsolva — bejelentkezéskor kódot kérünk."
              : "Extra védelem a fiókodnak egy authenticator-alkalmazással."}
          </div>
        </div>
      </div>
      {factor ? (
        <div className="flex items-center gap-2">
          {confirmRemove && <Badge variant="warning">Biztos?</Badge>}
          <Button
            size="sm"
            variant={confirmRemove ? "danger" : "secondary"}
            onClick={removeFactor}
            disabled={busy}
          >
            {confirmRemove ? "Kattints újra" : "Kikapcsolás"}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={startEnroll} disabled={busy}>
          Bekapcsolás
        </Button>
      )}
    </div>
  );
}

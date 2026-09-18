"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass, linkClass } from "@/components/ui/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === "verified");
      setLoading(false);
      if (factor) {
        setMfaFactorId(factor.id);
        return;
      }
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId,
      code: mfaCode.trim(),
    });

    setLoading(false);

    if (error) {
      setError("Hibás kód — ellenőrizd, és próbáld újra.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (mfaFactorId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-foreground">Kétfaktoros hitelesítés</h1>
          <p className="mt-1 text-sm text-muted">
            Add meg az authenticator-alkalmazásodban látható 6 jegyű kódot.
          </p>

          <form onSubmit={handleMfaSubmit} className="mt-5 flex flex-col gap-4">
            <div className={fieldGroupClass}>
              <span className={labelClass}>Kód</span>
              <input
                inputMode="numeric"
                autoFocus
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "Ellenőrzés…" : "Belépés"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <Link href="/" className="flex items-center justify-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <Building2 className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </Link>

      <Card className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Bejelentkezés</h1>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Jelszó</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Belépés…" : "Belépés"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        Nincs még fiókod?{" "}
        <Link href="/signup" className={linkClass}>
          Regisztráció
        </Link>
      </p>
    </main>
  );
}

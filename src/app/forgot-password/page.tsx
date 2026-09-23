"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass, linkClass } from "@/components/ui/styles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    // Always show the same success state regardless of whether the email
    // matched an account — Supabase itself doesn't reveal that either, so
    // this page shouldn't leak it through a different error path.
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <Link href="/" className="flex items-center justify-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <Building2 className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </Link>

      <Card className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Elfelejtett jelszó</h1>

        {sent ? (
          <div className="mt-5 flex flex-col gap-4">
            <p className="text-sm text-muted">
              Ha létezik fiók a(z) <span className="text-foreground">{email}</span> email
              címmel, elküldtünk rá egy linket, amivel új jelszót állíthatsz be. Nézd meg a
              postaládád (és a spam mappát is).
            </p>
            <Link href="/login" className={linkClass}>
              ← Vissza a bejelentkezéshez
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Add meg az email címed, és küldünk egy linket az új jelszó beállításához.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div className={fieldGroupClass}>
                <span className={labelClass}>Email</span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" disabled={loading} className="mt-1">
                {loading ? "Küldés…" : "Link küldése"}
              </Button>
            </form>
          </>
        )}
      </Card>

      {!sent && (
        <p className="text-center text-sm text-muted">
          <Link href="/login" className={linkClass}>
            ← Vissza a bejelentkezéshez
          </Link>
        </p>
      )}
    </main>
  );
}

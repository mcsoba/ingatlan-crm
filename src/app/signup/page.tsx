"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass, linkClass } from "@/components/ui/styles";

export default function SignupPage() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { agency_name: agencyName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      // Email confirmation disabled in the Supabase project — we already
      // have a session, so go straight to the dashboard, which creates
      // the agency + profile on first load.
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-hover">
          <MailCheck className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h1 className="text-lg font-semibold text-foreground">
          Erősítsd meg az email címed
        </h1>
        <p className="text-sm text-muted">
          Küldtünk egy megerősítő linket a(z) {email} címre. A linkre kattintva
          jön létre az irodád.
        </p>
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
        <h1 className="text-lg font-semibold text-foreground">Regisztráció</h1>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Iroda / ügynök neve</span>
            <input
              type="text"
              required
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className={inputClass}
            />
          </div>

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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Regisztráció…" : "Regisztráció"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        Van már fiókod?{" "}
        <Link href="/login" className={linkClass}>
          Bejelentkezés
        </Link>
      </p>
    </main>
  );
}

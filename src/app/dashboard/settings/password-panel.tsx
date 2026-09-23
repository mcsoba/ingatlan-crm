"use client";

import { useState } from "react";
import { KeyRound, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";

export function PasswordPanel({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function reset() {
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Az új jelszónak legalább 6 karakter hosszúnak kell lennie.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A két új jelszó nem egyezik.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // Re-verify identity with the current password before changing it —
    // updateUser() alone would accept the change from anyone with an
    // already-open session (e.g. a shared/unlocked browser).
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      setBusy(false);
      setError("A jelenlegi jelszó helytelen.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setBusy(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }

    toast({ title: "Jelszó módosítva", variant: "success" });
    reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start text-sm text-muted hover:text-accent"
      >
        <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
        Jelszó módosítása
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className={fieldGroupClass}>
        <span className={labelClass}>Jelenlegi jelszó</span>
        <input
          type="password"
          required
          autoFocus
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
      </div>
      <div className={fieldGroupClass}>
        <span className={labelClass}>Új jelszó</span>
        <input
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
      </div>
      <div className={fieldGroupClass}>
        <span className={labelClass}>Új jelszó megerősítése</span>
        <input
          type="password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
      </div>

      {error && <span className="text-xs text-danger">{error}</span>}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>
          {busy ? (
            "Mentés…"
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Jelszó mentése
            </>
          )}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>
          Mégse
        </Button>
      </div>
    </form>
  );
}

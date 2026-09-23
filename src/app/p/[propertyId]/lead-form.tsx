"use client";

import { useState } from "react";
import { Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";

export function LeadForm({
  agencyId,
  propertyId,
}: {
  agencyId: string;
  propertyId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, propertyId, name, email, phone, message, hp }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Hiba történt");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt");
    } finally {
      setIsSending(false);
    }
  }

  if (sent) {
    return (
      <Card className="flex items-center gap-2.5 p-4 text-sm">
        <Check className="h-4 w-4 text-success" />
        Köszönjük az érdeklődést! Hamarosan felvesszük veled a kapcsolatot.
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-foreground">
        Érdekel ez az ingatlan?
      </h2>
      <p className="mt-1 text-sm text-muted">
        Hagyd itt az elérhetőséged, és hamarosan felvesszük veled a kapcsolatot.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        {/* Honeypot: rejtett mező, valós felhasználó sosem tölti ki, bot igen. */}
        <input
          type="text"
          name="company"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        <div className={fieldGroupClass}>
          <span className={labelClass}>Név</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Email (opcionális)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className={fieldGroupClass}>
            <span className={labelClass}>Telefon (opcionális)</span>
            <input
              placeholder="+36 30 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className={fieldGroupClass}>
          <span className={labelClass}>Üzenet (opcionális)</span>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <span className="text-xs text-danger">{error}</span>}

        <Button type="submit" disabled={isSending} className="mt-1 self-start">
          {isSending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Küldés
        </Button>
      </form>
    </Card>
  );
}

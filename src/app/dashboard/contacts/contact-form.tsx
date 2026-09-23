"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Copy, Check, Loader2, TriangleAlert, Send, MessageSquare } from "lucide-react";
import {
  checkDuplicateContact,
  generateFollowUpEmail,
  sendFollowUpEmail,
  generateSmsDraft,
  sendSmsToContact,
  mergeContacts,
  type DuplicateMatch,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, fieldGroupClass } from "@/components/ui/styles";
import { queueToast } from "@/components/ui/toast";

type ContactFormProps = {
  action: (formData: FormData) => void;
  contactId?: string;
  defaultValues?: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    source?: string;
    status?: string;
    notes?: string | null;
  };
  submitLabel: string;
};

export function ContactForm({
  action,
  contactId,
  defaultValues,
  submitLabel,
}: ContactFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [email, setEmail] = useState(defaultValues?.email ?? "");
  const [phone, setPhone] = useState(defaultValues?.phone ?? "");
  const [source, setSource] = useState(defaultValues?.source ?? "other");
  const [status, setStatus] = useState(defaultValues?.status ?? "new");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");

  const [isSaving, startSaving] = useTransition();
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Queued before the call: create/update redirect server-side, so this
    // component unmounts before any code after the call would run.
    queueToast({
      title: contactId ? "Kontakt elmentve" : "Kontakt létrehozva",
      variant: "success",
    });
    startSaving(() => {
      action(formData);
    });
  }

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmMergeId, setConfirmMergeId] = useState<string | null>(null);
  const [isMerging, startMerging] = useTransition();
  const [mergeError, setMergeError] = useState<string | null>(null);

  function handleMerge(duplicateId: string) {
    if (!contactId) return;
    if (confirmMergeId !== duplicateId) {
      setConfirmMergeId(duplicateId);
      return;
    }
    setMergeError(null);
    startMerging(async () => {
      try {
        await mergeContacts(contactId, duplicateId);
        // Reload so the (now possibly filled-in) email/phone/notes fields
        // reflect the merge — a router.refresh() wouldn't reset this
        // client component's uncontrolled form state.
        window.location.reload();
      } catch (err) {
        setMergeError(err instanceof Error ? err.message : "Hiba történt");
        setConfirmMergeId(null);
      }
    });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim() && !email.trim() && !phone.trim()) return;

    debounceRef.current = setTimeout(() => {
      checkDuplicateContact({ name, email, phone, excludeId: contactId })
        .then(setDuplicates)
        .catch(() => {
          // Non-critical — silently skip the duplicate hint on failure.
        });
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, phone]);

  const [followUp, setFollowUp] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [isSending, startSending] = useTransition();

  function handleGenerate() {
    setFollowUpError(null);
    setCopied(false);
    setSent(false);
    startGenerating(async () => {
      try {
        const draft = await generateFollowUpEmail({ name, status, source, notes });
        setFollowUp(draft);
      } catch (err) {
        setFollowUpError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(followUp);
      setCopied(true);
    } catch {
      setFollowUpError("A vágólapra másolás nem sikerült, jelöld ki kézzel");
    }
  }

  function handleSend() {
    if (!contactId) return;
    setFollowUpError(null);
    setSent(false);
    startSending(async () => {
      try {
        await sendFollowUpEmail(contactId, followUp);
        setSent(true);
      } catch (err) {
        setFollowUpError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  const [sms, setSms] = useState("");
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [isGeneratingSms, startGeneratingSms] = useTransition();
  const [isSendingSms, startSendingSms] = useTransition();

  function handleGenerateSms() {
    setSmsError(null);
    setSmsSent(false);
    startGeneratingSms(async () => {
      try {
        const draft = await generateSmsDraft({ name, status, source, notes });
        setSms(draft);
      } catch (err) {
        setSmsError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  function handleSendSms() {
    if (!contactId) return;
    setSmsError(null);
    setSmsSent(false);
    startSendingSms(async () => {
      try {
        await sendSmsToContact(contactId, sms);
        setSmsSent(true);
      } catch (err) {
        setSmsError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <Card className="p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className={fieldGroupClass}>
            <span className={labelClass}>Név</span>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Email (opcionális)</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Telefon (opcionális)</span>
            <input
              name="phone"
              placeholder="+36 30 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>

          {duplicates.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
              <div className="flex items-center gap-1.5 font-medium">
                <TriangleAlert className="h-3.5 w-3.5" />
                Lehet, hogy már létezik ilyen kontakt
              </div>
              {duplicates.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/contacts/${d.id}/edit`}
                    target="_blank"
                    className="underline hover:no-underline"
                  >
                    {d.name} {d.email ? `· ${d.email}` : d.phone ? `· ${d.phone}` : ""}
                  </Link>
                  {contactId && (
                    <button
                      type="button"
                      onClick={() => handleMerge(d.id)}
                      disabled={isMerging}
                      className="shrink-0 font-medium whitespace-nowrap text-warning underline hover:no-underline disabled:opacity-50"
                    >
                      {isMerging && confirmMergeId === d.id
                        ? "Összevonás…"
                        : confirmMergeId === d.id
                          ? "Biztos? Kattints újra"
                          : "Összevonás ezzel"}
                    </button>
                  )}
                </div>
              ))}
              {mergeError && <span className="text-danger">{mergeError}</span>}
            </div>
          )}

          <div className={fieldGroupClass}>
            <span className={labelClass}>Forrás</span>
            <select
              name="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={inputClass}
            >
              <option value="website">Weboldal</option>
              <option value="referral">Ajánlás</option>
              <option value="phone">Telefon</option>
              <option value="walk_in">Betérő</option>
              <option value="other">Egyéb</option>
            </select>
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Státusz</span>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="new">Új</option>
              <option value="contacted">Felvéve a kapcsolat</option>
              <option value="qualified">Minősített</option>
              <option value="inactive">Inaktív</option>
            </select>
          </div>

          <div className={fieldGroupClass}>
            <span className={labelClass}>Jegyzet (opcionális)</span>
            <textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>

          <Button type="submit" className="mt-1" disabled={isSaving}>
            {submitLabel}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <span className={labelClass}>Follow-up email vázlat</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating || !name.trim()}
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            )}
            AI vázlat generálása
          </Button>
        </div>
        <textarea
          rows={8}
          value={followUp}
          onChange={(e) => {
            setFollowUp(e.target.value);
            setCopied(false);
            setSent(false);
          }}
          placeholder="Kattints az „AI vázlat generálása” gombra, a kontakt neve, státusza és jegyzete alapján ír egy follow-up emailt."
          className={`${inputClass} font-mono text-xs`}
        />
        {followUp && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Másolva" : "Másolás vágólapra"}
            </Button>
            {contactId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSend}
                disabled={isSending || !email.trim()}
                title={!email.trim() ? "Nincs email cím megadva ehhez a kontakthoz" : undefined}
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : sent ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {sent ? "Elküldve" : "Elküldés emailben"}
              </Button>
            )}
          </div>
        )}
        {followUpError && (
          <span className="text-xs text-danger">{followUpError}</span>
        )}
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between">
          <span className={labelClass}>SMS vázlat</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateSms}
            disabled={isGeneratingSms || !name.trim()}
          >
            {isGeneratingSms ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            )}
            AI vázlat generálása
          </Button>
        </div>
        <textarea
          rows={3}
          value={sms}
          onChange={(e) => {
            setSms(e.target.value);
            setSmsSent(false);
          }}
          placeholder="Kattints az „AI vázlat generálása” gombra egy rövid SMS-vázlatért, vagy írj sajátot."
          className={`${inputClass} font-mono text-xs`}
        />
        {sms && (
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-xs ${sms.length > 300 ? "text-danger" : "text-muted-subtle"}`}
            >
              {sms.length} / 300 karakter
            </span>
            {contactId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendSms}
                disabled={isSendingSms || !phone.trim()}
                title={!phone.trim() ? "Nincs telefonszám megadva ehhez a kontakthoz" : undefined}
              >
                {isSendingSms ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : smsSent ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5" />
                )}
                {smsSent ? "Elküldve" : "Elküldés SMS-ben"}
              </Button>
            )}
          </div>
        )}
        {smsError && <span className="text-xs text-danger">{smsError}</span>}
      </Card>
    </div>
  );
}

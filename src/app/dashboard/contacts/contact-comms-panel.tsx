"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check, Loader2, Send, MessageSquare } from "lucide-react";
import {
  generateFollowUpEmail,
  sendFollowUpEmail,
  generateSmsDraft,
  sendSmsToContact,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass } from "@/components/ui/styles";

type ContactCommsPanelProps = {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
};

export function ContactCommsPanel({
  contactId,
  name,
  email,
  phone,
  source,
  status,
  notes,
}: ContactCommsPanelProps) {
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
        const draft = await generateFollowUpEmail({ name, status, source, notes: notes ?? "" });
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
        const draft = await generateSmsDraft({ name, status, source, notes: notes ?? "" });
        setSms(draft);
      } catch (err) {
        setSmsError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  function handleSendSms() {
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
    <div className="flex flex-col gap-6">
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSend}
              disabled={isSending || !email?.trim()}
              title={!email?.trim() ? "Nincs email cím megadva ehhez a kontakthoz" : undefined}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendSms}
              disabled={isSendingSms || !phone?.trim()}
              title={!phone?.trim() ? "Nincs telefonszám megadva ehhez a kontakthoz" : undefined}
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
          </div>
        )}
        {smsError && <span className="text-xs text-danger">{smsError}</span>}
      </Card>
    </div>
  );
}

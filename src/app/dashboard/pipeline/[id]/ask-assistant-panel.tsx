"use client";

import { useState, useTransition } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { askDealAssistant, type ChatMessage } from "../actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

const SUGGESTIONS = [
  "Mi legyen a következő lépés?",
  "Foglald össze ezt az ügyletet 2 mondatban",
  "Mire figyeljek a következő hívásnál?",
];

export function AskAssistantPanel({ dealId }: { dealId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setError(null);
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");

    startSending(async () => {
      try {
        const reply = await askDealAssistant(dealId, next);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-accent" />
        Kérdezd a CRM-et
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted hover:border-accent/40 hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-accent text-white"
                  : "self-start bg-background text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))}
          {isSending && (
            <div className="self-start rounded-lg bg-background px-3 py-2 text-sm text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Kérdezz bármit erről az ügyletről…"
          className={`${inputClass} flex-1`}
        />
        <Button type="submit" disabled={isSending || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

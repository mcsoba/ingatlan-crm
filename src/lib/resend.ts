import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

let resendInstance: Resend | null = null;

// Lazy, same reason as getStripe() in src/lib/stripe.ts — constructing with
// a missing key would throw immediately at module-import time and could
// crash a page that merely imports this module.
export function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY nincs beállítva — add meg a .env.local-ban az email-küldéshez",
      );
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Resend teszt módban (nincs saját verifikált domain) csak erről a címről
// lehet küldeni, és csak a fiók tulajdonosának saját email címére.
export const EMAIL_FROM =
  process.env.RESEND_FROM_EMAIL || `${BRAND.name} <onboarding@resend.dev>`;

// Az iroda postafiókja az automatikus (nem ügynökhöz kötött) levelek
// válaszaihoz — a feladó cím jellemzően csak küldésre van beállítva.
export const EMAIL_REPLY_TO = process.env.RESEND_REPLY_TO || undefined;

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

const PRIVATE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

// SSRF-vedelem: az irodak tetszoleges URL-t megadhatnak, ahova a rendszer
// szerver-oldalrol POST-ol egy publikus (bejelentkezes nelkuli) form
// beerkezesekor -- enelkul valaki a sajat belso halozatunkra/localhostra
// mutato cimet adhatna meg, es a mi szerverunket hasznalna probeolasra.
// Ez csak literal IP-ket/hostneveket sziuret, DNS-rebinding ellen nem ved --
// dokumentalt v1-korlat.
export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const hostname = url.hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(hostname)) return false;
  if (hostname.endsWith(".local")) return false;
  if (isPrivateIPv4(hostname)) return false;

  return true;
}

const WEBHOOK_TIMEOUT_MS = 5000;

// Uj lead erkezesekor hivjuk meg -- a meglevo email/SMS-ertesites MELLETT,
// sose helyette. Ugyanaz a minta, mint a notifyAgency/notifyAgencySms
// (api/leads/route.ts): a hiba sose akaszthatja el a lead mentesét.
export async function sendLeadWebhook(url: string, payload: unknown): Promise<void> {
  if (!isSafeWebhookUrl(url)) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Nem kritikus -- a lead a CRM-ben már mentve van.
  } finally {
    clearTimeout(timeout);
  }
}

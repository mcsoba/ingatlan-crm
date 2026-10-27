// A szerver (Vercel) UTC-ben fut, a "ma" viszont a magyar napot jelenti.
export const TZ = "Europe/Budapest";

export function budapestEndOfToday(now: Date = new Date()): Date {
  const day = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+0";
  const [h, m] = offset.slice(1).split(":");
  const sign = offset.startsWith("-") ? "-" : "+";
  return new Date(`${day}T23:59:59${sign}${h!.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`);
}

function budapestOffset(at: Date): string {
  const raw =
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+0";
  const [h, m] = raw.slice(1).split(":");
  return `${raw.startsWith("-") ? "-" : "+"}${h!.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

// Űrlapról jövő dátum ("2026-10-27") + nem kötelező időpont ("14:00") magyar
// idő szerint. Időpont nélkül reggel 9 — mint a mobilon a "Holnap"/"Jövő hét".
export function budapestDateTime(date: string, time?: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hhmm = time && /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  return new Date(`${date}T${hhmm}:00${budapestOffset(new Date(`${date}T12:00:00Z`))}`);
}

// Határidő kiírása: "okt. 27. 14:00"
export function formatDue(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

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

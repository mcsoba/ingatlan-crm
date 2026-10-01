export function formatHuf(n: number | null | undefined, perMonth = false): string {
  if (n == null) return "Ár nincs megadva";
  return new Intl.NumberFormat("hu-HU").format(n) + " Ft" + (perMonth ? "/hó" : "");
}

export function formatDue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(today)) / 86400000);
  const time = d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Ma ${time}`;
  if (diffDays === 1) return `Holnap ${time}`;
  if (diffDays === -1) return `Tegnap ${time}`;
  return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + ` ${time}`;
}

export function isOverdue(iso: string | null): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

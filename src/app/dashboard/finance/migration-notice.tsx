import { Card } from "@/components/ui/card";

/** A tábla még nem létezik (a migráció nem futott le) — Postgres 42P01 / PostgREST PGRST205. */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703");
}

export function MigrationNotice({ file }: { file: string }) {
  return (
    <Card className="flex flex-col gap-2 border-warning/40 p-5 text-sm">
      <div className="font-semibold text-foreground">Ehhez a részhez egy adatbázis-frissítés kell</div>
      <p className="text-muted">
        Futtasd le a <code className="rounded bg-background px-1">supabase/migrations/{file}</code> fájl tartalmát a Supabase SQL Editorban, majd
        töltsd újra az oldalt.
      </p>
    </Card>
  );
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBackup } from "@/lib/backup";

// A mentés pár másodperc, de több tábla / sok sor esetén legyen tartalék
export const maxDuration = 60;

/** Napi adatbázis-mentés a privát „backups” tárolóba (Vercel Cron). Csak a CRON_SECRET-tel indítható. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // A többi cronnal ellentétben itt titok nélkül sem futunk (a mentés minden adatot érint)
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBackup(createAdminClient(), process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adatbázis-mentés: az összes (PostgREST-en elérhető) tábla minden sora egy tömörített JSON-ba,
 * a privát „backups” tárolóba. Naponta egy fájl (az utolsó 30 marad) + havonta egy (12 marad).
 * A feltöltött fájlok (blokkfotók, PDF-ek) nincsenek benne — azok a tárolóban külön vannak.
 *
 * Visszaállítás: a fájl `tables` mezője táblánként a sorokat tartalmazza, ugyanabban az
 * alakban, ahogy az adatbázisban vannak (insert-tel visszatölthető).
 */
export const BACKUP_BUCKET = "backups";
const PAGE = 1000;
const KEEP_DAILY = 30;
const KEEP_MONTHLY = 12;

async function listTables(url: string, key: string): Promise<string[]> {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Táblalista: ${res.status}`);
  const spec = (await res.json()) as { definitions?: Record<string, unknown> };
  return Object.keys(spec.definitions ?? {}).sort();
}

async function dumpTable(db: SupabaseClient, table: string): Promise<{ rows: unknown[]; error?: string }> {
  const rows: unknown[] = [];
  // stabil lapozáshoz id szerint rendezünk; ha nincs id oszlop, rendezés nélkül
  let order: string | null = "id";
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select("*");
    if (order) q = q.order(order);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) {
      if (order && from === 0) {
        order = null;
        from -= PAGE;
        continue;
      }
      return { rows, error: error.message };
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows };
}

async function ensureBucket(db: SupabaseClient) {
  const { data } = await db.storage.getBucket(BACKUP_BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(BACKUP_BUCKET, { public: false });
    if (error && !/exists/i.test(error.message)) throw error;
  }
}

async function prune(db: SupabaseClient, folder: string, keep: number) {
  const { data } = await db.storage.from(BACKUP_BUCKET).list(folder, { sortBy: { column: "name", order: "desc" }, limit: 1000 });
  const old = (data ?? []).filter((f) => f.id).slice(keep).map((f) => `${folder}/${f.name}`);
  if (old.length) await db.storage.from(BACKUP_BUCKET).remove(old);
  return old.length;
}

export async function runBackup(db: SupabaseClient, url: string, serviceKey: string, now = new Date()) {
  const tables = await listTables(url, serviceKey);
  const out: Record<string, unknown[]> = {};
  const errors: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const { rows, error } = await dumpTable(db, t);
    out[t] = rows;
    counts[t] = rows.length;
    if (error) errors[t] = error;
  }
  const payload = { created_at: now.toISOString(), format: 1, counts, errors, tables: out };
  const gz = gzipSync(Buffer.from(JSON.stringify(payload)));
  await ensureBucket(db);
  const day = now.toISOString().slice(0, 10);
  for (const path of [`daily/${day}.json.gz`, `monthly/${day.slice(0, 7)}.json.gz`]) {
    const { error } = await db.storage.from(BACKUP_BUCKET).upload(path, gz, { contentType: "application/gzip", upsert: true });
    if (error) throw error;
  }
  const pruned = (await prune(db, "daily", KEEP_DAILY)) + (await prune(db, "monthly", KEEP_MONTHLY));
  return { file: `daily/${day}.json.gz`, bytes: gz.length, tables: tables.length, rows: Object.values(counts).reduce((s, n) => s + n, 0), errors, pruned };
}

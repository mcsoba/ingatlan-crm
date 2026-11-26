// A legfrissebb napi adatbázis-mentés letöltése a saját gépre (a Supabase-en kívüli másolatnak).
// Használat:  node scripts/download-backup.mjs [célmappa]
// Alapértelmezett célmappa: <felhasználó>/Documents/bluegate-mentesek
// A .env.local-ból olvassa a NEXT_PUBLIC_SUPABASE_URL és a SUPABASE_SERVICE_ROLE_KEY értékét.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Hiányzik a NEXT_PUBLIC_SUPABASE_URL vagy a SUPABASE_SERVICE_ROLE_KEY a .env.local-ból");
const target = process.argv[2] ?? path.join(os.homedir(), "Documents", "bluegate-mentesek");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const list = await fetch(`${url}/storage/v1/object/list/backups`, { method: "POST", headers, body: JSON.stringify({ prefix: "daily/", limit: 100, sortBy: { column: "name", order: "desc" } }) });
if (!list.ok) throw new Error(`Lista: ${list.status} ${await list.text()}`);
const files = (await list.json()).filter((f) => f.id);
if (!files.length) throw new Error("Még nincs mentés a „backups” tárolóban");
const name = files[0].name;
const res = await fetch(`${url}/storage/v1/object/backups/daily/${name}`, { headers });
if (!res.ok) throw new Error(`Letöltés: ${res.status}`);
fs.mkdirSync(target, { recursive: true });
const out = path.join(target, name);
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log(`Letöltve: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

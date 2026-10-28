// Tulajdonosi fiók létrehozása egy új (privát kiadású) telepítéshez, nyilvános
// regisztráció nélkül. Az iroda az első belépéskor jön létre az agency_name
// alapján (ensureCurrentUserProfile → create_agency_with_owner).
//
//   node scripts/create-owner.mjs --env .env.bluegate --email iroda@example.com --agency "Bluegate Housing"
//
// Az ideiglenes jelszó a vágólapra kerül (Windows: clip), a kimenetbe nem.
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
if (!args.env || !args.email || !args.agency) {
  console.error('Használat: node scripts/create-owner.mjs --env <fájl> --email <cím> --agency "<iroda neve>"');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(args.env, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Hiányzik a NEXT_PUBLIC_SUPABASE_URL vagy a SUPABASE_SERVICE_ROLE_KEY: " + args.env);
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const password = crypto.randomBytes(12).toString("base64url") + "!7a";

const { data, error } = await admin.auth.admin.createUser({
  email: args.email,
  password,
  email_confirm: true,
  user_metadata: { agency_name: args.agency },
});
if (error) {
  console.error("Hiba: " + error.message);
  process.exit(1);
}

execSync("clip", { input: password });
console.log(`Kész: ${data.user.email} (${data.user.id}) a(z) ${new URL(url).host} projektben.`);
console.log("Az ideiglenes jelszó a vágólapon van — első belépés után érdemes megváltoztatni.");

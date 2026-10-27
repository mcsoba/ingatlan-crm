import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfiles } from "@/lib/push";
import { formatDue } from "@/lib/time";

// A mobilapp hívja, ha valaki másra bíz egy teendőt, üzletet vagy ügyfelet —
// ugyanazt a push-t kapja a kolléga, mint amikor a webről történik.
// A mobil nem látja mások push-tokenjeit (RLS), ezért kell ez a szerveroldali lépés.
// Hitelesítés: a felhasználó saját Supabase access tokenje; az érintett sort
// az ő jogosultságaival olvassuk ki, így csak a saját irodájában tud értesíteni.

type Body = { kind: "task" | "deal" | "contact"; id: string };

// A natív app nem küld CORS-előkérést; a böngészős előnézet (más porton) igen.
// A hitelesítés tokennel történik (nem sütivel), így a "*" origin biztonságos.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.id || !["task", "deal", "contact"].includes(body.kind)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers: CORS });
  }

  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const who = me?.full_name || "Egy kollégád";
  const admin = createAdminClient();
  let sent = 0;

  if (body.kind === "task") {
    const { data: a } = await supabase
      .from("activities")
      .select("content, due_at, assigned_to, contact_id, deal_id")
      .eq("id", body.id)
      .maybeSingle();
    if (a?.assigned_to && a.assigned_to !== user.id) {
      sent = await sendPushToProfiles(admin, [a.assigned_to], {
        title: "Új feladatot kaptál",
        body: `${who}: ${a.content}${a.due_at ? ` (határidő: ${formatDue(a.due_at)})` : ""}`,
        url: a.deal_id ? `/deal/${a.deal_id}` : a.contact_id ? `/contact/${a.contact_id}` : "/",
      });
    }
  } else if (body.kind === "deal") {
    const { data: d } = await supabase
      .from("deals")
      .select("owner_id, contacts(name)")
      .eq("id", body.id)
      .maybeSingle();
    if (d?.owner_id && d.owner_id !== user.id) {
      const contact = d.contacts as unknown as { name: string } | null;
      sent = await sendPushToProfiles(admin, [d.owner_id], {
        title: "Új üzletet kaptál",
        body: `${who} rád bízta: ${contact?.name ?? "üzlet"}`,
        url: `/deal/${body.id}`,
      });
    }
  } else {
    const { data: c } = await supabase.from("contacts").select("owner_id, name").eq("id", body.id).maybeSingle();
    if (c?.owner_id && c.owner_id !== user.id) {
      sent = await sendPushToProfiles(admin, [c.owner_id], {
        title: "Új ügyfelet kaptál",
        body: `${who} rád bízta: ${c.name}`,
        url: `/contact/${body.id}`,
      });
    }
  }

  return NextResponse.json({ sent }, { headers: CORS });
}

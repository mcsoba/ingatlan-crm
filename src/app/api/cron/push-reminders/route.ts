import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfiles } from "@/lib/push";

// Két feladat egy végponton:
// - alapból: a következő ~1 órában esedékes, még nem jelzett teendőkről push
//   a felelősnek (assigned_to, különben a deal / kontakt felelőse)
// - ?digest=1: reggeli összefoglaló mindenkinek, akinek van mára teendője
//   vagy fel nem hívott új érdeklődője

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

const TZ = "Europe/Budapest";

function budapestEndOfToday(now: Date): Date {
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

type ActivityRow = {
  id: string;
  type: string;
  content: string;
  due_at: string;
  assigned_to: string | null;
  contact_id: string | null;
  deal_id: string | null;
  deals: { owner_id: string | null; deleted_at: string | null } | null;
  contacts: { name: string; owner_id: string | null; deleted_at: string | null } | null;
};

function responsible(a: ActivityRow): string | null {
  return a.assigned_to ?? a.deals?.owner_id ?? a.contacts?.owner_id ?? null;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const now = new Date();
  const digest = new URL(request.url).searchParams.get("digest") === "1";

  if (digest) {
    const endOfToday = budapestEndOfToday(now);
    const [{ data: tasks }, { data: newLeads }, { data: tokenRows }] = await Promise.all([
      admin
        .from("activities")
        .select("id, type, content, due_at, assigned_to, contact_id, deal_id, deals(owner_id, deleted_at), contacts(name, owner_id, deleted_at)")
        .eq("done", false)
        .neq("type", "checklist")
        .not("due_at", "is", null)
        .lte("due_at", endOfToday.toISOString())
        .limit(2000),
      admin.from("contacts").select("owner_id").eq("status", "new").is("deleted_at", null).not("owner_id", "is", null),
      admin.from("push_tokens").select("profile_id"),
    ]);

    const withDevice = new Set((tokenRows ?? []).map((r) => r.profile_id as string));
    const perProfile = new Map<string, { today: number; overdue: number; leads: number }>();
    const bump = (id: string) => {
      if (!perProfile.has(id)) perProfile.set(id, { today: 0, overdue: 0, leads: 0 });
      return perProfile.get(id)!;
    };

    for (const a of (tasks ?? []) as unknown as ActivityRow[]) {
      if (a.deals?.deleted_at || a.contacts?.deleted_at) continue;
      const who = responsible(a);
      if (!who || !withDevice.has(who)) continue;
      const entry = bump(who);
      entry.today++;
      if (new Date(a.due_at) < now) entry.overdue++;
    }
    for (const c of newLeads ?? []) {
      const who = c.owner_id as string;
      if (withDevice.has(who)) bump(who).leads++;
    }

    let sent = 0;
    for (const [profileId, s] of perProfile) {
      const parts: string[] = [];
      if (s.today) parts.push(`${s.today} teendőd van mára${s.overdue ? ` (ebből ${s.overdue} lejárt)` : ""}`);
      if (s.leads) parts.push(`${s.leads} új érdeklődőt még nem kerestél`);
      if (!parts.length) continue;
      sent += await sendPushToProfiles(admin, [profileId], {
        title: "Jó reggelt! Ez vár ma rád",
        body: parts.join(", ") + ".",
        url: "/",
      });
    }
    return NextResponse.json({ mode: "digest", profiles: perProfile.size, sent });
  }

  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const { data, error } = await admin
    .from("activities")
    .select("id, type, content, due_at, assigned_to, contact_id, deal_id, deals(owner_id, deleted_at), contacts(name, owner_id, deleted_at)")
    .eq("done", false)
    .neq("type", "checklist")
    .is("push_sent_at", null)
    .gte("due_at", windowStart.toISOString())
    .lte("due_at", windowEnd.toISOString())
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  for (const a of (data ?? []) as unknown as ActivityRow[]) {
    const who = responsible(a);
    if (who && !a.deals?.deleted_at && !a.contacts?.deleted_at) {
      const time = new Date(a.due_at).toLocaleTimeString("hu-HU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
      const label = TYPE_LABELS[a.type] ?? "Teendő";
      sent += await sendPushToProfiles(admin, [who], {
        title: `${label} ${time}-kor${a.contacts?.name ? ` — ${a.contacts.name}` : ""}`,
        body: a.content,
        url: a.deal_id ? `/deal/${a.deal_id}` : a.contact_id ? `/contact/${a.contact_id}` : "/",
      });
    } else {
      skipped++;
    }
    // Akkor is jelöljük, ha nem volt kinek küldeni, hogy ne próbálkozzunk újra
    await admin.from("activities").update({ push_sent_at: now.toISOString() }).eq("id", a.id);
  }

  return NextResponse.json({ mode: "due-soon", due: data?.length ?? 0, sent, skipped });
}

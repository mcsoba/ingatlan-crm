import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";

type Activity = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  contacts: { name: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  note: "Jegyzet",
  call: "Hívás",
  viewing: "Megtekintés",
  reminder: "Emlékeztető",
};

function formatActivity(a: Activity): string {
  const label = TYPE_LABELS[a.type] ?? a.type;
  const who = a.contacts?.name ? ` (${a.contacts.name})` : "";
  return `- [${label}] ${a.content}${who}`;
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
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [{ data: agencies, error: agenciesError }, { data: profiles }, { data: usersPage }] =
    await Promise.all([
      admin.from("agencies").select("id, name"),
      admin.from("profiles").select("id, agency_id"),
      admin.auth.admin.listUsers({ perPage: 200 }),
    ]);

  if (agenciesError) {
    return NextResponse.json({ error: agenciesError.message }, { status: 500 });
  }

  const emailById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email]));
  const membersByAgency = new Map<string, string[]>();
  for (const p of profiles ?? []) {
    const email = emailById.get(p.id);
    if (!email) continue;
    const list = membersByAgency.get(p.agency_id) ?? [];
    list.push(email);
    membersByAgency.set(p.agency_id, list);
  }

  let sent = 0;

  for (const agency of agencies ?? []) {
    const recipients = membersByAgency.get(agency.id) ?? [];
    if (recipients.length === 0) continue;

    const [{ data: overdue }, { data: dueToday }, { data: newLeads }] = await Promise.all([
      admin
        .from("activities")
        .select("id, type, content, due_at, contacts(name)")
        .eq("agency_id", agency.id)
        .eq("done", false)
        .neq("type", "checklist")
        .lt("due_at", todayStart.toISOString())
        .not("due_at", "is", null)
        .order("due_at", { ascending: true })
        .limit(15),
      admin
        .from("activities")
        .select("id, type, content, due_at, contacts(name)")
        .eq("agency_id", agency.id)
        .eq("done", false)
        .neq("type", "checklist")
        .gte("due_at", todayStart.toISOString())
        .lt("due_at", todayEnd.toISOString())
        .order("due_at", { ascending: true })
        .limit(15),
      admin
        .from("contacts")
        .select("id, name, source")
        .eq("agency_id", agency.id)
        .gte("created_at", dayAgo.toISOString()),
    ]);

    const overdueList = (overdue ?? []) as unknown as Activity[];
    const todayList = (dueToday ?? []) as unknown as Activity[];
    const leadsList = newLeads ?? [];

    if (overdueList.length === 0 && todayList.length === 0 && leadsList.length === 0) {
      continue;
    }

    const sections = [
      overdueList.length > 0
        ? `Lejárt teendők (${overdueList.length}):\n${overdueList.map(formatActivity).join("\n")}`
        : null,
      todayList.length > 0
        ? `Mára esedékes teendők (${todayList.length}):\n${todayList.map(formatActivity).join("\n")}`
        : null,
      leadsList.length > 0
        ? `Új érdeklődők az elmúlt 24 órában (${leadsList.length}):\n${leadsList
            .map((l) => `- ${l.name}`)
            .join("\n")}`
        : null,
    ].filter((s): s is string => s !== null);

    const bodyText = [
      `Napi összefoglaló — ${agency.name}`,
      "",
      ...sections,
      "",
      `Megnyitás: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`,
    ].join("\n\n");

    try {
      const { error: sendError } = await getResend().emails.send({
        from: EMAIL_FROM,
        to: recipients,
        subject: `Napi összefoglaló — ${agency.name}`,
        html: textToHtml(bodyText),
        text: bodyText,
      });
      if (!sendError) sent++;
    } catch {
      // RESEND_API_KEY hiányzik vagy a küldés meghiúsult — ez az egy iroda
      // kimarad, a cron a többi irodával folytatja, nem áll le teljesen.
    }
  }

  return NextResponse.json({ ok: true, agencies: agencies?.length ?? 0, sent });
}

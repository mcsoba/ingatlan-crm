import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/twilio";

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
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: dueActivities, error: dueError } = await admin
    .from("activities")
    .select("id, content, due_at, contacts(name, phone)")
    .eq("type", "viewing")
    .eq("done", false)
    .eq("sms_reminder_sent", false)
    .gt("due_at", now.toISOString())
    .lte("due_at", in24h.toISOString())
    .limit(100);

  if (dueError) {
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const activity of dueActivities ?? []) {
    const contact = activity.contacts as unknown as { name: string; phone: string | null } | null;

    if (!contact?.phone) {
      await admin
        .from("activities")
        .update({ sms_reminder_sent: true })
        .eq("id", activity.id);
      skipped++;
      continue;
    }

    const dueTime = new Date(activity.due_at as string).toLocaleString("hu-HU", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const body = `Emlékeztető: holnap megtekintés — ${activity.content} (${dueTime})`;

    try {
      await sendSms(contact.phone, body);
      await admin
        .from("activities")
        .update({ sms_reminder_sent: true })
        .eq("id", activity.id);
      sent++;
    } catch {
      // TWILIO_* hiányzik vagy a küldés meghiúsult — sms_reminder_sent
      // marad false, a következő cron-futásnál újrapróbáljuk.
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, due: dueActivities?.length ?? 0, sent, skipped });
}

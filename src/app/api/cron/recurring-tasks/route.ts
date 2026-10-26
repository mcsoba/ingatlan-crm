import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function nextDueAt(dueAt: string, recurrence: string): string {
  const next = new Date(dueAt);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString();
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

  const { data: dueActivities, error } = await admin
    .from("activities")
    .select("id, agency_id, contact_id, deal_id, type, content, due_at, recurrence, assigned_to")
    .neq("recurrence", "none")
    .eq("next_occurrence_created", false)
    .not("due_at", "is", null)
    .lte("due_at", new Date().toISOString())
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let spawned = 0;

  for (const activity of dueActivities ?? []) {
    const { error: insertError } = await admin.from("activities").insert({
      agency_id: activity.agency_id,
      contact_id: activity.contact_id,
      deal_id: activity.deal_id,
      type: activity.type,
      content: activity.content,
      due_at: nextDueAt(activity.due_at as string, activity.recurrence),
      recurrence: activity.recurrence,
      assigned_to: activity.assigned_to,
      done: false,
      next_occurrence_created: false,
    });

    if (insertError) continue;

    await admin
      .from("activities")
      .update({ next_occurrence_created: true })
      .eq("id", activity.id);

    spawned++;
  }

  return NextResponse.json({ ok: true, due: dueActivities?.length ?? 0, spawned });
}

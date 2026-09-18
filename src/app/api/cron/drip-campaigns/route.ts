import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";

function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
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

  const { data: dueEnrollments, error: dueError } = await admin
    .from("email_sequence_enrollments")
    .select(
      "id, agency_id, sequence_id, contact_id, current_step, enrolled_at, contacts(name, email, deleted_at)",
    )
    .eq("status", "active")
    .not("next_send_at", "is", null)
    .lte("next_send_at", now.toISOString())
    .limit(100);

  if (dueError) {
    return NextResponse.json({ error: dueError.message }, { status: 500 });
  }

  let sent = 0;
  let completed = 0;
  let skipped = 0;

  for (const enrollment of dueEnrollments ?? []) {
    const contact = enrollment.contacts as unknown as {
      name: string;
      email: string | null;
      deleted_at: string | null;
    } | null;

    if (!contact?.email || contact.deleted_at) {
      await admin
        .from("email_sequence_enrollments")
        .update({ status: "cancelled", next_send_at: null })
        .eq("id", enrollment.id);
      skipped++;
      continue;
    }

    const nextStepNumber = enrollment.current_step + 1;
    const { data: step } = await admin
      .from("email_sequence_steps")
      .select("step_order, delay_days, subject, body")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", nextStepNumber)
      .maybeSingle();

    if (!step) {
      await admin
        .from("email_sequence_enrollments")
        .update({ status: "completed", next_send_at: null })
        .eq("id", enrollment.id);
      completed++;
      continue;
    }

    const vars = { name: contact.name };
    const subject = fillTemplate(step.subject, vars);
    const body = fillTemplate(step.body, vars);

    let sendFailed = false;
    try {
      const { error: sendError } = await getResend().emails.send({
        from: EMAIL_FROM,
        to: contact.email,
        subject,
        html: textToHtml(body),
        text: body,
      });
      sendFailed = Boolean(sendError);
    } catch {
      // RESEND_API_KEY hiányzik vagy a küldés meghiúsult — ezt a
      // beiratkozást kihagyjuk, a next_send_at változatlan marad, a
      // következő cron-futásnál újra megpróbáljuk.
      sendFailed = true;
    }

    if (sendFailed) {
      skipped++;
      continue;
    }

    const { data: futureStep } = await admin
      .from("email_sequence_steps")
      .select("delay_days")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_order", nextStepNumber + 1)
      .maybeSingle();

    const enrolledAt = new Date(enrollment.enrolled_at);
    const nextSendAt = futureStep
      ? new Date(enrolledAt.getTime() + futureStep.delay_days * 24 * 60 * 60 * 1000)
      : null;

    await admin
      .from("email_sequence_enrollments")
      .update({
        current_step: nextStepNumber,
        status: nextSendAt ? "active" : "completed",
        next_send_at: nextSendAt ? nextSendAt.toISOString() : null,
      })
      .eq("id", enrollment.id);

    await admin.from("activities").insert({
      agency_id: enrollment.agency_id,
      contact_id: enrollment.contact_id,
      type: "note",
      content: `Kampány email elküldve: „${subject}"`,
      email_body: body,
      sequence_id: enrollment.sequence_id,
    });

    if (!nextSendAt) completed++;
    sent++;
  }

  return NextResponse.json({
    ok: true,
    due: dueEnrollments?.length ?? 0,
    sent,
    completed,
    skipped,
  });
}

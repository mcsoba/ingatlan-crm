import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";
import { sendSms } from "@/lib/twilio";
import { sendLeadWebhook } from "@/lib/webhook";

const MAX_NAME_LENGTH = 200;
const MAX_CONTACT_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Spam-védelem: nincs bejelentkezés ezen a végponton, tehát bárki
// szkriptelhetné a hívásokat. Két olcsó, kulcs nélküli réteg:
// - honeypot mező (a valós felhasználó sosem tölti ki, egy egyszerű bot igen)
// - IP-alapú rate-limit a lead_submission_log táblára építve
const IP_WINDOW_MINUTES = 10;
const IP_MAX_SUBMISSIONS = 5;
const AGENCY_WINDOW_HOURS = 24;
const AGENCY_MAX_SUBMISSIONS = 3;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function autoEnroll(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  contactId: string,
  hasEmail: boolean,
) {
  if (!hasEmail) return;

  try {
    const { data: sequences } = await admin
      .from("email_sequences")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("trigger", "new_lead")
      .eq("active", true);

    if (!sequences || sequences.length === 0) return;

    for (const sequence of sequences) {
      const { data: firstStep } = await admin
        .from("email_sequence_steps")
        .select("delay_days")
        .eq("sequence_id", sequence.id)
        .eq("step_order", 1)
        .maybeSingle();

      if (!firstStep) continue;

      const nextSendAt = new Date(
        Date.now() + firstStep.delay_days * 24 * 60 * 60 * 1000,
      );

      await admin.from("email_sequence_enrollments").insert({
        agency_id: agencyId,
        sequence_id: sequence.id,
        contact_id: contactId,
        status: "active",
        current_step: 0,
        next_send_at: nextSendAt.toISOString(),
      });
    }
  } catch {
    // Nem kritikus — a lead a CRM-ben már mentve van, a kampány-beiratkozás
    // hiánya miatt nem szabad hibát dobni a beküldőnek.
  }
}

async function notifyAgency(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  agencyName: string,
  lead: { name: string; email: string | null; phone: string | null; notes: string },
) {
  try {
    const { data: members } = await admin
      .from("profiles")
      .select("id")
      .eq("agency_id", agencyId);

    if (!members || members.length === 0) return;

    const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email]));
    const recipients = members
      .map((m) => emailById.get(m.id))
      .filter((e): e is string => Boolean(e));

    if (recipients.length === 0) return;

    const bodyLines = [
      `Új érdeklődő érkezett a(z) ${agencyName} weboldaláról:`,
      "",
      `Név: ${lead.name}`,
      lead.email ? `Email: ${lead.email}` : null,
      lead.phone ? `Telefon: ${lead.phone}` : null,
      lead.notes ? `\n${lead.notes}` : null,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");

    await getResend().emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: `Új érdeklődő: ${lead.name}`,
      html: textToHtml(bodyLines),
      text: bodyLines,
    });
  } catch {
    // Az email-értesítés nem kritikus — a lead a CRM-ben már mentve van,
    // egy sikertelen küldés miatt nem szabad hibát dobni a beküldőnek.
  }
}

async function notifyAgencySms(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
  leadName: string,
) {
  try {
    const { data: members } = await admin
      .from("profiles")
      .select("phone")
      .eq("agency_id", agencyId)
      .not("phone", "is", null);

    const phones = (members ?? [])
      .map((m) => m.phone)
      .filter((p): p is string => Boolean(p));

    await Promise.all(
      phones.map((phone) =>
        sendSms(phone, `Új érdeklődő: ${leadName}. Nézd meg a CRM-ben.`),
      ),
    );
  } catch {
    // Az SMS-értesítés nem kritikus — a lead a CRM-ben már mentve van,
    // egy sikertelen küldés miatt nem szabad hibát dobni a beküldőnek.
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const { agencyId, propertyId, name, email, phone, message, hp } = body as Record<
    string,
    unknown
  >;

  if (typeof agencyId !== "string" || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "A név és az iroda azonosítója kötelező" },
      { status: 400 },
    );
  }

  const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);

  const leadEmail = typeof email === "string" && email.trim() ? email.trim() : null;
  if (leadEmail && (leadEmail.length > MAX_CONTACT_FIELD_LENGTH || !EMAIL_PATTERN.test(leadEmail))) {
    return NextResponse.json({ error: "Érvénytelen email cím" }, { status: 400 });
  }

  const leadPhone =
    typeof phone === "string" && phone.trim()
      ? phone.trim().slice(0, MAX_CONTACT_FIELD_LENGTH)
      : null;

  const admin = createAdminClient();

  const { data: agency } = await admin
    .from("agencies")
    .select("id, name, lead_webhook_url")
    .eq("id", agencyId)
    .maybeSingle();

  if (!agency) {
    return NextResponse.json({ error: "Ismeretlen iroda" }, { status: 404 });
  }

  const ip = getClientIp(request);
  const isHoneypotTripped = typeof hp === "string" && hp.trim() !== "";

  const ipWindowStart = new Date(Date.now() - IP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: ipCount } = await admin
    .from("lead_submission_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", ipWindowStart);

  const agencyWindowStart = new Date(
    Date.now() - AGENCY_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { count: agencyIpCount } = await admin
    .from("lead_submission_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("agency_id", agencyId)
    .gte("created_at", agencyWindowStart);

  const isRateLimited =
    (ipCount ?? 0) >= IP_MAX_SUBMISSIONS || (agencyIpCount ?? 0) >= AGENCY_MAX_SUBMISSIONS;
  const shouldBlock = isHoneypotTripped || isRateLimited;

  await admin.from("lead_submission_log").insert({
    agency_id: agencyId,
    ip,
    blocked: shouldBlock,
  });

  if (isHoneypotTripped) {
    // Ne áruljuk el a botnak, hogy blokkolva lett — sikeres válasz látszatát
    // keltjük, hogy a bot ne próbálkozzon másik módszerrel.
    return NextResponse.json({ ok: true });
  }

  if (isRateLimited) {
    return NextResponse.json(
      { error: "Túl sok próbálkozás, kérlek próbáld később." },
      { status: 429 },
    );
  }

  let notes =
    typeof message === "string" ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (typeof propertyId === "string" && propertyId) {
    const { data: property } = await admin
      .from("properties")
      .select("address")
      .eq("id", propertyId)
      .maybeSingle();
    if (property) {
      notes = `Érdeklődés ingatlanra: ${property.address}${notes ? `\n\n${notes}` : ""}`;
    }
  }

  const { data: insertedContact, error } = await admin
    .from("contacts")
    .insert({
      agency_id: agencyId,
      name: trimmedName,
      email: leadEmail,
      phone: leadPhone,
      source: "website",
      status: "new",
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Hiba történt a mentés során" }, { status: 500 });
  }

  await Promise.all([
    notifyAgency(admin, agencyId, agency.name, {
      name: trimmedName,
      email: leadEmail,
      phone: leadPhone,
      notes,
    }),
    notifyAgencySms(admin, agencyId, trimmedName),
    autoEnroll(admin, agencyId, insertedContact.id, Boolean(leadEmail)),
    agency.lead_webhook_url
      ? sendLeadWebhook(agency.lead_webhook_url, {
          agencyId,
          contactId: insertedContact.id,
          name: trimmedName,
          email: leadEmail,
          phone: leadPhone,
          message: notes || null,
          source: "website",
          createdAt: new Date().toISOString(),
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}

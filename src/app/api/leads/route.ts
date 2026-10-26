import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM, textToHtml } from "@/lib/resend";
import { sendSms } from "@/lib/twilio";
import { sendLeadWebhook } from "@/lib/webhook";
import { sendPushToAgency, sendPushToProfiles } from "@/lib/push";

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
  assignedName?: string | null,
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
      assignedName ? `\nKiosztva: ${assignedName}` : null,
      lead.notes ? `\n${lead.notes}` : null,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");

    await getResend().emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: assignedName
        ? `Új érdeklődő (kiosztva: ${assignedName}): ${lead.name}`
        : `Új érdeklődő: ${lead.name}`,
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
  assignedName?: string | null,
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

    const body = assignedName
      ? `Új érdeklődő: ${leadName} (kiosztva: ${assignedName}). Nézd meg a CRM-ben.`
      : `Új érdeklődő: ${leadName}. Nézd meg a CRM-ben.`;

    await Promise.all(phones.map((phone) => sendSms(phone, body)));
  } catch {
    // Az SMS-értesítés nem kritikus — a lead a CRM-ben már mentve van,
    // egy sikertelen küldés miatt nem szabad hibát dobni a beküldőnek.
  }
}

// Automatikus lead-kiosztás: a legkevesebb (nyitott) kontakttal rendelkező
// csapattag kapja a lead-et -- ez egy önkiegyensúlyozó körbeosztás, nincs
// szükség külön "ki jött utoljára" mutató-táblára, és új/eltávolított
// csapattagoknál is magától helyesen viselkedik.
async function assignLeadRoundRobin(
  admin: ReturnType<typeof createAdminClient>,
  agencyId: string,
): Promise<{ id: string; full_name: string | null } | null> {
  const { data: members } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("agency_id", agencyId);

  if (!members || members.length === 0) return null;

  const { data: assigned } = await admin
    .from("contacts")
    .select("owner_id")
    .eq("agency_id", agencyId)
    .is("deleted_at", null)
    .not("owner_id", "is", null);

  const counts = new Map<string, number>();
  for (const member of members) counts.set(member.id, 0);
  for (const row of assigned ?? []) {
    if (row.owner_id) counts.set(row.owner_id, (counts.get(row.owner_id) ?? 0) + 1);
  }

  let winner = members[0];
  let winnerCount = counts.get(winner.id) ?? 0;
  for (const member of members.slice(1)) {
    const count = counts.get(member.id) ?? 0;
    if (count < winnerCount) {
      winner = member;
      winnerCount = count;
    }
  }

  return winner;
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
    .select("id, name, lead_webhook_url, auto_assign_leads")
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
      .is("deleted_at", null)
      .maybeSingle();
    if (property) {
      notes = `Érdeklődés ingatlanra: ${property.address}${notes ? `\n\n${notes}` : ""}`;
    }
  }

  const assignee = agency.auto_assign_leads
    ? await assignLeadRoundRobin(admin, agencyId)
    : null;

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
      owner_id: assignee?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Hiba történt a mentés során" }, { status: 500 });
  }

  await Promise.all([
    notifyAgency(
      admin,
      agencyId,
      agency.name,
      {
        name: trimmedName,
        email: leadEmail,
        phone: leadPhone,
        notes,
      },
      assignee?.full_name,
    ),
    notifyAgencySms(admin, agencyId, trimmedName, assignee?.full_name),
    autoEnroll(admin, agencyId, insertedContact.id, Boolean(leadEmail)),
    // Kiosztott lead: csak a felelős kap értesítést; különben az egész iroda
    (() => {
      const push = {
        title: assignee ? "Új érdeklődőt kaptál" : "Új érdeklődő érkezett",
        body: `${trimmedName} — hívd fel minél előbb${leadPhone ? ` (${leadPhone})` : ""}.`,
        url: `/contact/${insertedContact.id}`,
      };
      return assignee
        ? sendPushToProfiles(admin, [assignee.id], push)
        : sendPushToAgency(admin, agencyId, push);
    })(),
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureCurrentUserProfile } from "@/lib/agency";

export type NotificationActivity = {
  id: string;
  content: string;
  due_at: string;
  contactId: string | null;
  dealId: string | null;
};

export type NotificationLead = {
  id: string;
  name: string;
  created_at: string;
};

export type NotificationsData = {
  overdue: NotificationActivity[];
  dueToday: NotificationActivity[];
  newLeads: NotificationLead[];
};

export async function getNotifications(): Promise<NotificationsData> {
  await ensureCurrentUserProfile();
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [{ data: overdue }, { data: dueToday }, { data: newLeads }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, content, due_at, contact_id, deal_id")
      .eq("done", false)
      .neq("type", "checklist")
      .not("due_at", "is", null)
      .lt("due_at", todayStart.toISOString())
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("activities")
      .select("id, content, due_at, contact_id, deal_id")
      .eq("done", false)
      .neq("type", "checklist")
      .gte("due_at", todayStart.toISOString())
      .lt("due_at", todayEnd.toISOString())
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("contacts")
      .select("id, name, created_at")
      .gte("created_at", dayAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const mapActivity = (a: { id: string; content: string; due_at: string; contact_id: string | null; deal_id: string | null }): NotificationActivity => ({
    id: a.id,
    content: a.content,
    due_at: a.due_at,
    contactId: a.contact_id,
    dealId: a.deal_id,
  });

  return {
    overdue: (overdue ?? []).map(mapActivity),
    dueToday: (dueToday ?? []).map(mapActivity),
    newLeads: newLeads ?? [],
  };
}

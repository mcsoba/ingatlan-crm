import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { BellOff, Check, ChevronRight, LogOut, Phone, PhoneCall } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { formatDue, isOverdue } from "../../lib/format";
import { ACTIVITY_TYPE_LABELS } from "../../lib/labels";
import { callPhone } from "../../lib/contact-actions";
import { getPushStatus, type PushStatus } from "../../lib/push";
import { Badge, Card, ErrorBox, Loading } from "../../components/ui";
import { NextStepSheet } from "../../components/NextStepSheet";

type Task = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  contact_id: string | null;
  deal_id: string | null;
  contacts: { name: string } | null;
};
type Lead = { id: string; name: string; phone: string | null; created_at: string };
type StuckDeal = { id: string; contact_id: string; contacts: { name: string } | null; pipeline_stages: { name: string } | null };
type Scope = "mine" | "office";
type NextStep = { contactId: string | null; dealId: string | null; subtitle: string | null; title?: string };

function waitingFor(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "ma érkezett" : days === 1 ? "tegnap érkezett" : `${days} napja vár`;
}

export default function TodayScreen() {
  const c = useColors();
  const { profile, signOut } = useAuth();
  const [scope, setScope] = useState<Scope>("mine");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stuck, setStuck] = useState<StuckDeal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const [push, setPush] = useState<PushStatus>("unavailable");

  useEffect(() => {
    getPushStatus().then(setPush).catch(() => {});
  }, [profile]);

  const load = useCallback(async () => {
    if (!profile) return;
    const mine = scope === "mine";
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    weekAhead.setHours(23, 59, 59, 999);

    let tq = supabase
      .from("activities")
      .select("id, type, content, due_at, contact_id, deal_id, contacts(name)")
      .eq("done", false)
      .neq("type", "checklist")
      .not("due_at", "is", null)
      .lte("due_at", weekAhead.toISOString())
      .order("due_at", { ascending: true })
      .limit(200);
    if (mine) tq = tq.eq("assigned_to", profile.id);

    let lq = supabase
      .from("contacts")
      .select("id, name, phone, created_at")
      .eq("status", "new")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(20);
    if (mine) lq = lq.eq("owner_id", profile.id);

    let dq = supabase
      .from("deals")
      .select("id, contact_id, contacts(name), pipeline_stages(name)")
      .eq("status", "open")
      .is("deleted_at", null)
      .limit(200);
    if (mine) dq = dq.eq("owner_id", profile.id);

    const [tRes, lRes, dRes] = await Promise.all([tq, lq, dq]);
    if (tRes.error || lRes.error || dRes.error) {
      setError("Nem sikerült betölteni a teendőket.");
      return;
    }

    // Elakadt üzlet = nyitott üzlet, amihez (vagy az ügyfeléhez) nincs nyitott, határidős teendő
    const deals = (dRes.data ?? []) as unknown as StuckDeal[];
    let stuckDeals: StuckDeal[] = [];
    if (deals.length) {
      const { data: open } = await supabase
        .from("activities")
        .select("deal_id, contact_id")
        .eq("done", false)
        .not("due_at", "is", null)
        .or(
          `deal_id.in.(${deals.map((d) => d.id).join(",")}),contact_id.in.(${deals.map((d) => d.contact_id).join(",")})`,
        );
      const covered = new Set<string>();
      for (const a of open ?? []) {
        if (a.deal_id) covered.add(a.deal_id);
        if (a.contact_id) covered.add(`c:${a.contact_id}`);
      }
      stuckDeals = deals.filter((d) => !covered.has(d.id) && !covered.has(`c:${d.contact_id}`)).slice(0, 15);
    }

    setError(null);
    setTasks((tRes.data ?? []) as unknown as Task[]);
    setLeads((lRes.data ?? []) as Lead[]);
    setStuck(stuckDeals);
  }, [profile, scope]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function complete(task: Task) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? null);
    const { error: err } = await supabase.from("activities").update({ done: true }).eq("id", task.id);
    if (err) {
      setError("Nem sikerült késznek jelölni. Próbáld újra.");
      load();
      return;
    }
    if (task.contact_id || task.deal_id) {
      setNextStep({
        title: "Kész! Mi a következő lépés?",
        subtitle: task.contacts?.name ?? null,
        contactId: task.contact_id,
        dealId: task.deal_id,
      });
    }
  }

  // "Felhívtam": állapot → Megkeresve, a hívás rögzítése, majd a következő lépés
  async function markCalled(lead: Lead) {
    if (!profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    const [u, a] = await Promise.all([
      supabase.from("contacts").update({ status: "contacted" }).eq("id", lead.id),
      supabase.from("activities").insert({
        agency_id: profile.agency_id,
        contact_id: lead.id,
        type: "call",
        content: "Első telefonos kapcsolatfelvétel",
        done: true,
      }),
    ]);
    if (u.error || a.error) {
      setError("Nem sikerült menteni. Próbáld újra.");
      load();
      return;
    }
    setNextStep({ subtitle: lead.name, contactId: lead.id, dealId: null });
  }

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const all = tasks ?? [];
  const today = all.filter((t) => t.due_at && new Date(t.due_at) <= endOfToday);
  const upcoming = all.filter((t) => t.due_at && new Date(t.due_at) > endOfToday);
  const overdueCount = today.filter(
    (t) => isOverdue(t.due_at) && new Date(t.due_at!).toDateString() !== new Date().toDateString(),
  ).length;
  const firstName = profile?.full_name?.split(" ").slice(-1)[0];
  const nothingToDo = tasks !== null && !today.length && !leads.length && !stuck.length;

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hello, { color: c.text }]}>Szia{firstName ? `, ${firstName}` : ""}!</Text>
            <Text style={{ color: c.muted, fontSize: 14 }}>{profile?.agencyName ?? ""}</Text>
          </View>
          <Pressable accessibilityLabel="Kijelentkezés" onPress={signOut} hitSlop={12}>
            <LogOut color={c.muted} size={22} />
          </Pressable>
        </View>

        <View style={[styles.segment, { backgroundColor: c.border }]}>
          {(["mine", "office"] as const).map((s) => (
            <Pressable key={s} onPress={() => setScope(s)} style={[styles.segmentItem, scope === s && { backgroundColor: c.surface }]}>
              <Text style={{ color: scope === s ? c.text : c.muted, fontWeight: "700" }}>
                {s === "mine" ? "Az én feladataim" : "Az egész iroda"}
              </Text>
            </Pressable>
          ))}
        </View>

        {push === "denied" ? (
          <Pressable onPress={() => Linking.openSettings()} style={[styles.banner, { backgroundColor: c.warningSoft }]}>
            <BellOff size={18} color={c.warning} />
            <Text style={{ color: c.text, flex: 1, fontSize: 14 }}>
              Az értesítések ki vannak kapcsolva, így nem szólunk az új érdeklődőkről. Koppints a bekapcsoláshoz.
            </Text>
          </Pressable>
        ) : null}

        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {tasks === null && !error ? <Loading /> : null}

        {tasks !== null ? (
          <>
            {nothingToDo ? (
              <Card style={{ alignItems: "center", paddingVertical: 24, gap: 6, marginTop: 14 }}>
                <Text style={{ fontSize: 32 }}>🎉</Text>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>Mára mindennel megvagy!</Text>
                <Text style={{ color: c.muted, textAlign: "center" }}>
                  Nincs lejárt teendő, hívandó érdeklődő vagy elakadt üzlet.
                </Text>
              </Card>
            ) : (
              <View style={styles.summary}>
                <SummaryPill n={today.length} label="mai teendő" tone={overdueCount ? c.danger : c.accent} />
                <SummaryPill n={leads.length} label="hívandó" tone={c.warning} />
                <SummaryPill n={stuck.length} label="elakadt üzlet" tone={c.text} />
              </View>
            )}

            {today.length ? (
              <Section
                title={`Mai teendők${overdueCount ? ` · ${overdueCount} lejárt` : ""}`}
                hint="Pipáld ki, ha megvan. Utána megkérdezzük, mi a következő lépés."
                danger={overdueCount > 0}
              >
                {today.map((t) => (
                  <TaskRow key={t.id} task={t} onDone={() => complete(t)} />
                ))}
              </Section>
            ) : null}

            {leads.length ? (
              <Section
                title="Hívd fel őket"
                hint="Új érdeklődők, akiket még senki nem keresett. Hívás után nyomd meg a „Felhívtam” gombot."
              >
                {leads.map((l) => (
                  <Card key={l.id} style={styles.leadRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: "/contact/[id]", params: { id: l.id } })}>
                      <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{l.name}</Text>
                      <Text style={{ color: c.muted, fontSize: 13 }}>
                        {l.phone ?? "Nincs telefonszám"} · {waitingFor(l.created_at)}
                      </Text>
                    </Pressable>
                    {l.phone ? (
                      <Pressable
                        accessibilityLabel="Hívás"
                        onPress={() => callPhone(l.phone!)}
                        hitSlop={6}
                        style={[styles.round, { backgroundColor: c.successSoft }]}
                      >
                        <Phone size={20} color={c.success} />
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => markCalled(l)} hitSlop={6} style={[styles.calledBtn, { backgroundColor: c.accent }]}>
                      <PhoneCall size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Felhívtam</Text>
                    </Pressable>
                  </Card>
                ))}
              </Section>
            ) : null}

            {stuck.length ? (
              <Section
                title="Elakadt üzletek"
                hint="Nyitott üzletek, amelyekhez nincs ütemezve következő lépés. Koppints, és add meg, mi a teendő."
              >
                {stuck.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setNextStep({ subtitle: d.contacts?.name ?? null, contactId: d.contact_id, dealId: d.id })}
                  >
                    <Card style={styles.stuckRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{d.contacts?.name ?? "Üzlet"}</Text>
                        <Text style={{ color: c.muted, fontSize: 13 }}>
                          {d.pipeline_stages?.name ?? ""} · nincs következő lépés
                        </Text>
                      </View>
                      <Text style={{ color: c.accent, fontWeight: "700" }}>Ütemezés</Text>
                      <ChevronRight size={18} color={c.accent} />
                    </Card>
                  </Pressable>
                ))}
              </Section>
            ) : null}

            {upcoming.length ? (
              <Section title="Következő 7 nap">
                {upcoming.map((t) => (
                  <TaskRow key={t.id} task={t} onDone={() => complete(t)} />
                ))}
              </Section>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <NextStepSheet
        visible={!!nextStep}
        title={nextStep?.title}
        subtitle={nextStep?.subtitle}
        contactId={nextStep?.contactId}
        dealId={nextStep?.dealId}
        onClose={() => {
          setNextStep(null);
          load();
        }}
      />
    </>
  );
}

function Section({ title, hint, danger, children }: { title: string; hint?: string; danger?: boolean; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={[styles.sectionTitle, { color: danger ? c.danger : c.text }]}>{title}</Text>
      {hint ? (
        <Text style={{ color: c.muted, fontSize: 13, marginBottom: 10, marginTop: 2 }}>{hint}</Text>
      ) : (
        <View style={{ height: 8 }} />
      )}
      {children}
    </View>
  );
}

function SummaryPill({ n, label, tone }: { n: number; label: string; tone: string }) {
  const c = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={{ color: n ? tone : c.subtle, fontSize: 22, fontWeight: "800" }}>{n}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function TaskRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const c = useColors();
  const overdue = isOverdue(task.due_at);
  const open = () => {
    if (task.deal_id) router.push({ pathname: "/deal/[id]", params: { id: task.deal_id } });
    else if (task.contact_id) router.push({ pathname: "/contact/[id]", params: { id: task.contact_id } });
  };
  return (
    <Card style={styles.task}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Kész"
        onPress={onDone}
        hitSlop={10}
        style={[styles.check, { borderColor: overdue ? c.danger : c.accent }]}
      >
        <Check size={16} color={c.accent} strokeWidth={3} opacity={0.25} />
      </Pressable>
      <Pressable style={{ flex: 1, gap: 4 }} onPress={open}>
        <Text style={[styles.taskText, { color: c.text }]}>{task.content}</Text>
        <View style={styles.meta}>
          <Badge label={ACTIVITY_TYPE_LABELS[task.type] ?? task.type} tone="accent" />
          <Text style={{ color: overdue ? c.danger : c.muted, fontSize: 13, fontWeight: overdue ? "700" : "400" }}>
            {overdue ? "Lejárt: " : ""}
            {formatDue(task.due_at)}
          </Text>
          {task.contacts?.name ? <Text style={{ color: c.muted, fontSize: 13 }}>· {task.contacts.name}</Text> : null}
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  hello: { fontSize: 24, fontWeight: "800" },
  segment: { flexDirection: "row", borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, marginTop: 12 },
  summary: { flexDirection: "row", gap: 8, marginTop: 14 },
  pill: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  task: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  taskText: { fontSize: 16, lineHeight: 22 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  leadRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  calledBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 42, borderRadius: 21 },
  stuckRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
});

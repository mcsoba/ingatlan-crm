import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Check, LogOut } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { formatDue, isOverdue } from "../../lib/format";
import { ACTIVITY_TYPE_LABELS } from "../../lib/labels";
import { Badge, Card, EmptyState, ErrorBox, Loading, SectionTitle } from "../../components/ui";

type Task = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  contact_id: string | null;
  deal_id: string | null;
  contacts: { name: string } | null;
};

export default function TodayScreen() {
  const c = useColors();
  const { profile, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    weekAhead.setHours(23, 59, 59, 999);
    const { data, error: err } = await supabase
      .from("activities")
      .select("id, type, content, due_at, contact_id, deal_id, contacts(name)")
      .eq("done", false)
      .not("due_at", "is", null)
      .lte("due_at", weekAhead.toISOString())
      .order("due_at", { ascending: true })
      .limit(200);
    if (err) setError("Nem sikerült betölteni a teendőket.");
    else {
      setError(null);
      setTasks((data ?? []) as unknown as Task[]);
    }
  }, []);

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
    }
  }

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const today = (tasks ?? []).filter((t) => t.due_at && new Date(t.due_at) <= endOfToday);
  const upcoming = (tasks ?? []).filter((t) => t.due_at && new Date(t.due_at) > endOfToday);
  const overdueCount = today.filter((t) => isOverdue(t.due_at) && new Date(t.due_at!).toDateString() !== new Date().toDateString()).length;

  const firstName = profile?.full_name?.split(" ").slice(-1)[0];

  return (
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

      {error ? <ErrorBox message={error} onRetry={load} /> : null}
      {tasks === null && !error ? <Loading /> : null}

      {tasks !== null ? (
        <>
          <SectionTitle>
            Mai teendők{overdueCount ? ` · ${overdueCount} lejárt` : ""}
          </SectionTitle>
          {today.length === 0 ? (
            <Card>
              <EmptyState title="Mára nincs több teendő 🎉" text="Az új teendőket a kontaktoknál veheted fel." />
            </Card>
          ) : (
            today.map((t) => <TaskRow key={t.id} task={t} onDone={() => complete(t)} />)
          )}

          {upcoming.length > 0 ? (
            <>
              <SectionTitle>Következő 7 nap</SectionTitle>
              {upcoming.map((t) => (
                <TaskRow key={t.id} task={t} onDone={() => complete(t)} />
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function TaskRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const c = useColors();
  const overdue = isOverdue(task.due_at);
  const open = () => {
    if (task.contact_id) router.push({ pathname: "/contact/[id]", params: { id: task.contact_id } });
    else if (task.deal_id) router.push({ pathname: "/deal/[id]", params: { id: task.deal_id } });
  };
  return (
    <Card style={styles.task}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Kész"
        onPress={onDone}
        hitSlop={10}
        style={[styles.check, { borderColor: c.accent }]}
      >
        <Check size={16} color={c.accent} strokeWidth={3} opacity={0.25} />
      </Pressable>
      <Pressable style={{ flex: 1, gap: 4 }} onPress={open}>
        <Text style={[styles.taskText, { color: c.text }]}>{task.content}</Text>
        <View style={styles.meta}>
          <Badge label={ACTIVITY_TYPE_LABELS[task.type] ?? task.type} tone="accent" />
          <Text style={{ color: overdue ? c.danger : c.muted, fontSize: 13, fontWeight: overdue ? "700" : "400" }}>
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
  header: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  hello: { fontSize: 24, fontWeight: "800" },
  task: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  taskText: { fontSize: 16, lineHeight: 22 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});

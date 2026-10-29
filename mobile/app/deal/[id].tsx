import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { AlertTriangle, CalendarClock, ChevronRight, Compass, Pencil, Phone, RotateCcw, Trophy, XCircle } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useColors } from "../../lib/theme";
import { formatDue, formatHuf, isOverdue } from "../../lib/format";
import { callPhone } from "../../lib/contact-actions";
import { Badge, Button, Card, ErrorBox, Loading, SectionTitle } from "../../components/ui";
import { ActivityComposer } from "../../components/ActivityComposer";
import { NextStepSheet } from "../../components/NextStepSheet";
import { stageGuidance } from "../../lib/process";
import { memberName, useTeam } from "../../lib/team";
import { useAuth } from "../../context/AuthContext";
import { ActivityEditSheet } from "../../components/ActivityEditSheet";
import { ACTIVITY_COLUMNS, ActivityHistory, type HistoryActivity } from "../../components/ActivityHistory";

type Deal = {
  id: string;
  stage_id: string;
  deal_type: string;
  deal_amount: number | null;
  commission_rate: number | null;
  owner_id: string | null;
  notes: string | null;
  lost_reason: string | null;
  status: string;
  contact_id: string;
  property_id: string | null;
  contacts: { name: string; phone: string | null } | null;
  properties: { address: string; price: number | null } | null;
};
type Stage = { id: string; name: string; position: number; guidance: string | null };
type Activity = HistoryActivity;

export default function DealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | { title?: string }>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const team = useTeam();
  const { profile } = useAuth();

  const load = useCallback(async () => {
    const [dRes, sRes, aRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, stage_id, deal_type, deal_amount, commission_rate, owner_id, notes, lost_reason, status, contact_id, property_id, contacts(name, phone), properties(address, price)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("pipeline_stages").select("id, name, position, guidance").order("position"),
      supabase
        .from("activities")
        .select(ACTIVITY_COLUMNS)
        .eq("deal_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (dRes.error || !dRes.data) {
      setError("Nem sikerült betölteni az üzletet.");
      return;
    }
    setError(null);
    setDeal(dRes.data as unknown as Deal);
    setStages((sRes.data ?? []) as Stage[]);
    setActivities((aRes.data ?? []) as Activity[]);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Ugyanaz, mint a webes moveDeal: szakasz + updated_at frissítése
  async function moveTo(stageId: string) {
    if (!deal || stageId === deal.stage_id) return;
    Haptics.selectionAsync().catch(() => {});
    setDeal({ ...deal, stage_id: stageId });
    const { error: err } = await supabase
      .from("deals")
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .eq("id", deal.id);
    if (err) {
      setError("Nem sikerült áthelyezni az üzletet.");
      load();
    }
  }

  async function toggleDone(a: Activity) {
    setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)));
    const { error: err } = await supabase.from("activities").update({ done: !a.done }).eq("id", a.id);
    if (err) load();
    else if (!a.done) setSheet({ title: "Kész! Mi a következő lépés?" });
  }

  // Mint a webes markDealWon: az utolsó (Zárás) szakaszba kerül
  async function markWon() {
    if (!deal || !stages.length) return;
    const last = stages[stages.length - 1]!;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const { error: err } = await supabase
      .from("deals")
      .update({ stage_id: last.id, status: "open", updated_at: new Date().toISOString() })
      .eq("id", deal.id);
    if (err) setError("Nem sikerült menteni.");
    load();
  }

  async function markLost() {
    if (!deal) return;
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from("deals")
      .update({ status: "lost", lost_reason: lostReason.trim() || null, lost_at: now, updated_at: now })
      .eq("id", deal.id);
    if (err) setError("Nem sikerült menteni.");
    setLostOpen(false);
    setLostReason("");
    load();
  }

  async function reopen() {
    if (!deal) return;
    const { error: err } = await supabase
      .from("deals")
      .update({ status: "open", lost_reason: null, lost_at: null, updated_at: new Date().toISOString() })
      .eq("id", deal.id);
    if (err) setError("Nem sikerült menteni.");
    load();
  }

  if (error && !deal) return <ErrorBox message={error} onRetry={load} />;
  if (!deal) return <Loading />;

  const currentStage = stages.find((s) => s.id === deal.stage_id);
  const guidance = stageGuidance(currentStage);
  const nextTask = activities
    .filter((a) => !a.done && a.due_at)
    .sort((x, y) => new Date(x.due_at!).getTime() - new Date(y.due_at!).getTime())[0];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          title: deal.contacts?.name ?? "Üzlet",
          headerRight: () => (
            <Pressable
              accessibilityLabel="Üzlet szerkesztése"
              hitSlop={10}
              onPress={() => router.push({ pathname: "/deal/edit/[id]", params: { id: deal.id } })}
              style={{ padding: 4 }}
            >
              <Pencil size={22} color={c.accent} />
            </Pressable>
          ),
        }}
      />
      {error ? <ErrorBox message={error} /> : null}

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Badge label={deal.deal_type === "rent" ? "Bérlés" : "Eladás"} tone="accent" />
        {deal.status === "lost" ? <Badge label="Elvesztett" tone="danger" /> : null}
        {deal.deal_amount ? <Badge label={formatHuf(deal.deal_amount)} tone="success" /> : null}
      </View>

      <Card style={{ gap: 0, padding: 0 }}>
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push({ pathname: "/contact/[id]", params: { id: deal.contact_id } })}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.muted, fontSize: 12 }}>Ügyfél</Text>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{deal.contacts?.name}</Text>
          </View>
          {deal.contacts?.phone ? (
            <Pressable
              accessibilityLabel="Hívás"
              onPress={() => callPhone(deal.contacts!.phone!)}
              hitSlop={8}
              style={[styles.call, { backgroundColor: c.successSoft }]}
            >
              <Phone size={18} color={c.success} />
            </Pressable>
          ) : null}
          <ChevronRight color={c.subtle} size={20} />
        </Pressable>
        {deal.property_id ? (
          <Pressable
            style={[styles.linkRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
            onPress={() => router.push({ pathname: "/property/[id]", params: { id: deal.property_id! } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.muted, fontSize: 12 }}>Ingatlan</Text>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
                {deal.properties?.address}
              </Text>
            </View>
            <ChevronRight color={c.subtle} size={20} />
          </Pressable>
        ) : null}
      </Card>

      <Pressable onPress={() => router.push({ pathname: "/deal/edit/[id]", params: { id: deal.id } })}>
        <Card style={{ marginTop: 12, gap: 6 }}>
          <DetailRow label="Felelős" value={memberName(team, deal.owner_id, profile?.id)} />
          <DetailRow label="Végleges ár" value={deal.deal_amount != null ? formatHuf(deal.deal_amount) : "—"} />
          <DetailRow
            label="Jutalék"
            value={
              deal.commission_rate != null
                ? `${deal.commission_rate}%${deal.deal_amount != null ? ` · ${formatHuf(Math.round((deal.deal_amount * deal.commission_rate) / 100))}` : ""}`
                : "—"
            }
          />
          {deal.notes ? <Text style={{ color: c.text, lineHeight: 20, marginTop: 4 }}>{deal.notes}</Text> : null}
          <Text style={{ color: c.accent, fontWeight: "600", marginTop: 4 }}>Adatok szerkesztése</Text>
        </Card>
      </Pressable>

      {deal.status === "lost" ? (
        <Card style={{ marginTop: 16, gap: 10, borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <Text style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>Elvesztett üzlet</Text>
          {deal.lost_reason ? <Text style={{ color: c.text }}>Ok: {deal.lost_reason}</Text> : null}
          <Button label="Újranyitás" variant="secondary" icon={<RotateCcw size={18} color={c.text} />} onPress={reopen} />
        </Card>
      ) : null}

      {deal.status !== "lost" ? (
        <Card style={{ marginTop: 16, gap: 12, borderColor: c.accent, backgroundColor: c.accentSoft }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Compass size={20} color={c.accent} />
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "800" }}>Mit kell most tenned?</Text>
          </View>
          {guidance ? (
            <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>
              <Text style={{ fontWeight: "700" }}>{currentStage?.name}: </Text>
              {guidance}
            </Text>
          ) : null}
          {nextTask ? (
            <View style={[styles.nextRow, { backgroundColor: c.surface }]}>
              <CalendarClock size={18} color={isOverdue(nextTask.due_at) ? c.danger : c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.muted, fontSize: 12 }}>Következő lépés</Text>
                <Text style={{ color: c.text, fontWeight: "600" }} numberOfLines={2}>
                  {nextTask.content}
                </Text>
                <Text style={{ color: isOverdue(nextTask.due_at) ? c.danger : c.muted, fontSize: 13, fontWeight: "600" }}>
                  {isOverdue(nextTask.due_at) ? "Lejárt: " : ""}
                  {formatDue(nextTask.due_at)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.nextRow, { backgroundColor: c.warningSoft }]}>
              <AlertTriangle size={18} color={c.warning} />
              <Text style={{ color: c.text, flex: 1 }}>Nincs ütemezett következő lépés, így az ügy könnyen elakad.</Text>
            </View>
          )}
          <Pressable onPress={() => setSheet({})} style={[styles.nextBtn, { backgroundColor: c.accent }]}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {nextTask ? "Újabb lépés ütemezése" : "Következő lépés megadása"}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      <SectionTitle>Szakasz – koppints a továbblépéshez</SectionTitle>
      <View style={{ gap: 8 }}>
        {stages.map((s, i) => {
          const currentIndex = stages.findIndex((x) => x.id === deal.stage_id);
          const active = s.id === deal.stage_id;
          const passed = i < currentIndex;
          return (
            <Pressable
              key={s.id}
              onPress={() => moveTo(s.id)}
              style={[
                styles.stageRow,
                {
                  borderColor: active ? c.accent : c.border,
                  backgroundColor: active ? c.accentSoft : c.surface,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: active || passed ? c.accent : c.border }]} />
              <Text style={{ color: c.text, fontWeight: active ? "800" : "500", fontSize: 15 }}>{s.name}</Text>
              {active ? <Text style={{ color: c.accent, marginLeft: "auto", fontWeight: "700" }}>Jelenleg</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Jegyzet vagy teendő rögzítése</SectionTitle>
      <ActivityComposer dealId={deal.id} contactId={deal.contact_id} onSaved={load} />

      <SectionTitle>Előzmények</SectionTitle>
      <ActivityHistory
        activities={activities}
        emptyText="Még nincs bejegyzés ehhez az üzlethez."
        onToggleDone={toggleDone}
        onEdit={setEditing}
      />

      {deal.status !== "lost" ? (
        <>
          <SectionTitle>Lezárás</SectionTitle>
          <View style={{ gap: 8 }}>
            <Button label="Sikeres lezárás (Zárás)" icon={<Trophy size={18} color="#fff" />} onPress={markWon} />
            {lostOpen ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: c.text, fontWeight: "700" }}>Miért veszett el? (nem kötelező)</Text>
                <TextInput
                  value={lostReason}
                  onChangeText={setLostReason}
                  placeholder="pl. máshol vásárolt, túl drága volt"
                  placeholderTextColor={c.subtle}
                  style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
                />
                <Button label="Elveszettnek jelölöm" variant="danger" onPress={markLost} />
                <Button label="Mégse" variant="secondary" onPress={() => setLostOpen(false)} />
              </Card>
            ) : (
              <Button
                label="Elveszettnek jelölés"
                variant="secondary"
                icon={<XCircle size={18} color={c.text} />}
                onPress={() => setLostOpen(true)}
              />
            )}
          </View>
        </>
      ) : null}

      <ActivityEditSheet
        activity={editing}
        onClose={(changed) => {
          setEditing(null);
          if (changed) load();
        }}
      />
      <NextStepSheet
        visible={!!sheet}
        title={sheet?.title}
        subtitle={deal.contacts?.name}
        contactId={deal.contact_id}
        dealId={deal.id}
        onClose={() => {
          setSheet(null);
          load();
        }}
      />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: c.muted }}>{label}</Text>
      <Text style={{ color: c.text, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  call: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12 },
  nextBtn: { minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});

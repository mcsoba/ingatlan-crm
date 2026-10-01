import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChevronRight, Phone } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useColors } from "../../lib/theme";
import { formatDue, formatHuf, isOverdue } from "../../lib/format";
import { ACTIVITY_TYPE_LABELS } from "../../lib/labels";
import { callPhone } from "../../lib/contact-actions";
import { Badge, Card, ErrorBox, Loading, SectionTitle } from "../../components/ui";
import { ActivityComposer } from "../../components/ActivityComposer";

type Deal = {
  id: string;
  stage_id: string;
  deal_type: string;
  deal_amount: number | null;
  status: string;
  contact_id: string;
  property_id: string | null;
  contacts: { name: string; phone: string | null } | null;
  properties: { address: string; price: number | null } | null;
};
type Stage = { id: string; name: string; position: number };
type Activity = { id: string; type: string; content: string; due_at: string | null; done: boolean; created_at: string };

export default function DealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dRes, sRes, aRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, stage_id, deal_type, deal_amount, status, contact_id, property_id, contacts(name, phone), properties(address, price)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("pipeline_stages").select("id, name, position").order("position"),
      supabase
        .from("activities")
        .select("id, type, content, due_at, done, created_at")
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
  }

  if (error && !deal) return <ErrorBox message={error} onRetry={load} />;
  if (!deal) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: deal.contacts?.name ?? "Üzlet" }} />
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

      <SectionTitle>Új bejegyzés</SectionTitle>
      <ActivityComposer dealId={deal.id} contactId={deal.contact_id} onSaved={load} />

      <SectionTitle>Előzmények</SectionTitle>
      {activities.length === 0 ? (
        <Text style={{ color: c.muted }}>Még nincs bejegyzés ehhez az üzlethez.</Text>
      ) : (
        activities.map((a) => (
          <Card key={a.id} style={{ marginBottom: 8, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge label={ACTIVITY_TYPE_LABELS[a.type] ?? a.type} tone="accent" />
              {a.due_at ? (
                <Pressable onPress={() => toggleDone(a)} hitSlop={8}>
                  <Badge
                    label={a.done ? "✓ Kész" : `${formatDue(a.due_at)} – jelöld késznek`}
                    tone={a.done ? "success" : isOverdue(a.due_at) ? "danger" : "warning"}
                  />
                </Pressable>
              ) : null}
            </View>
            <Text
              style={{
                color: a.done ? c.muted : c.text,
                lineHeight: 21,
                textDecorationLine: a.done ? "line-through" : "none",
              }}
            >
              {a.content}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  call: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { formatHuf } from "../../lib/format";
import { Badge, Card, EmptyState, ErrorBox, Loading } from "../../components/ui";

type Stage = { id: string; name: string; position: number };
type Deal = {
  id: string;
  stage_id: string;
  deal_type: string;
  deal_amount: number | null;
  owner_id: string | null;
  contacts: { name: string } | null;
  properties: { address: string } | null;
};

export default function PipelineScreen() {
  const c = useColors();
  const { profile } = useAuth();
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [sRes, dRes] = await Promise.all([
      supabase.from("pipeline_stages").select("id, name, position").order("position"),
      supabase
        .from("deals")
        .select("id, stage_id, deal_type, deal_amount, owner_id, contacts(name), properties(address)")
        .is("deleted_at", null)
        .eq("status", "open")
        .order("updated_at", { ascending: false }),
    ]);
    if (sRes.error || dRes.error) {
      setError("Nem sikerült betölteni az üzleteket.");
      return;
    }
    setError(null);
    const s = (sRes.data ?? []) as Stage[];
    setStages(s);
    setDeals((dRes.data ?? []) as unknown as Deal[]);
    setActiveStage((prev) => prev ?? s[0]?.id ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error && !stages) return <ErrorBox message={error} onRetry={load} />;
  if (!stages) return <Loading />;

  const visibleDeals = deals.filter((d) => !mineOnly || d.owner_id === profile?.id);
  const countFor = (stageId: string) => visibleDeals.filter((d) => d.stage_id === stageId).length;
  const inStage = visibleDeals.filter((d) => d.stage_id === activeStage);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.stageBar}
      >
        {stages.map((s) => {
          const active = s.id === activeStage;
          return (
            <Pressable
              key={s.id}
              onPress={() => setActiveStage(s.id)}
              style={[styles.stage, { borderColor: c.border, backgroundColor: active ? c.accent : c.surface }]}
            >
              <Text style={{ color: active ? "#fff" : c.text, fontWeight: "700" }}>{s.name}</Text>
              <View style={[styles.count, { backgroundColor: active ? "rgba(255,255,255,0.25)" : c.bg }]}>
                <Text style={{ color: active ? "#fff" : c.muted, fontSize: 12, fontWeight: "700" }}>{countFor(s.id)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mineRow}>
        {[
          { label: "Az iroda üzletei", value: false },
          { label: "Saját üzleteim", value: true },
        ].map((f) => (
          <Pressable
            key={f.label}
            onPress={() => setMineOnly(f.value)}
            style={[styles.chip, { borderColor: c.border, backgroundColor: mineOnly === f.value ? c.text : c.surface }]}
          >
            <Text style={{ color: mineOnly === f.value ? c.surface : c.text, fontSize: 13, fontWeight: "600" }}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorBox message={error} onRetry={load} /> : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={c.accent}
          />
        }
      >
        {inStage.length === 0 ? (
          <EmptyState title="Ebben a szakaszban nincs üzlet" text="Az üzletet a megnyitása után tudod továbbléptetni." />
        ) : (
          inStage.map((d) => (
            <Pressable key={d.id} onPress={() => router.push({ pathname: "/deal/[id]", params: { id: d.id } })}>
              <Card style={{ gap: 6 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{d.contacts?.name ?? "Névtelen"}</Text>
                <Text style={{ color: c.muted }} numberOfLines={1}>
                  {d.properties?.address ?? "Ingatlan nélkül"}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Badge label={d.deal_type === "rent" ? "Bérlés" : "Eladás"} tone="accent" />
                  {d.deal_amount ? <Text style={{ color: c.text, fontWeight: "600" }}>{formatHuf(d.deal_amount)}</Text> : null}
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stageBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  stage: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  count: { minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  mineRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});

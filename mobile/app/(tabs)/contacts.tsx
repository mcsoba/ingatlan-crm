import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Phone, Plus } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { initials } from "../../lib/format";
import { CONTACT_STATUS_LABELS } from "../../lib/labels";
import { callPhone } from "../../lib/contact-actions";
import { Badge, EmptyState, ErrorBox, Loading, SearchInput } from "../../components/ui";

type Contact = { id: string; name: string; phone: string | null; email: string | null; status: string; owner_id: string | null };

const STATUS_TONE: Record<string, "accent" | "warning" | "success" | "neutral"> = {
  new: "accent",
  contacted: "warning",
  qualified: "success",
  inactive: "neutral",
};

export default function ContactsScreen() {
  const c = useColors();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let q = supabase
      .from("contacts")
      .select("id, name, phone, email, status, owner_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    const term = query.trim().replace(/[%,()]/g, "");
    if (term) q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    if (mineOnly && profile) q = q.eq("owner_id", profile.id);
    const { data, error: err } = await q;
    if (err) setError("Nem sikerült betölteni a kontaktokat.");
    else {
      setError(null);
      setContacts((data ?? []) as Contact[]);
    }
  }, [query, mineOnly, profile]);

  // Keresés gépelés közben, kis késleltetéssel
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

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

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <SearchInput placeholder="Név, telefon vagy e-mail" value={query} onChangeText={setQuery} />
        <View style={styles.filters}>
          {[
            { label: "Összes", value: false },
            { label: "Saját kontaktjaim", value: true },
          ].map((f) => (
            <Pressable
              key={f.label}
              onPress={() => setMineOnly(f.value)}
              style={[
                styles.chip,
                { borderColor: c.border, backgroundColor: mineOnly === f.value ? c.accent : c.surface },
              ]}
            >
              <Text style={{ color: mineOnly === f.value ? "#fff" : c.text, fontWeight: "600" }}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <ErrorBox message={error} onRetry={load} /> : null}

      {contacts === null && !error ? (
        <Loading />
      ) : (
        <FlatList
          data={contacts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
          ListEmptyComponent={
            <EmptyState
              title={query ? "Nincs találat" : "Még nincs kontakt"}
              text={query ? "Próbálj más keresőszót." : "Az új érdeklődőket a + gombbal veheted fel."}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/contact/[id]", params: { id: item.id } })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: c.accent, fontWeight: "700" }}>{initials(item.name)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Badge label={CONTACT_STATUS_LABELS[item.status] ?? item.status} tone={STATUS_TONE[item.status] ?? "neutral"} />
                  {item.phone ? <Text style={{ color: c.muted, fontSize: 13 }}>{item.phone}</Text> : null}
                </View>
              </View>
              {item.phone ? (
                <Pressable
                  accessibilityLabel={`${item.name} hívása`}
                  onPress={() => callPhone(item.phone!)}
                  hitSlop={8}
                  style={[styles.callBtn, { backgroundColor: c.successSoft }]}
                >
                  <Phone size={20} color={c.success} />
                </Pressable>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <Pressable
        accessibilityLabel="Új kontakt"
        onPress={() => router.push("/contact/new")}
        style={[styles.fab, { backgroundColor: c.accent }]}
      >
        <Plus color="#fff" size={26} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: 16, paddingBottom: 8, gap: 10 },
  filters: { flexDirection: "row", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "600" },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 3px 8px rgba(0, 0, 0, 0.2)",
  },
});

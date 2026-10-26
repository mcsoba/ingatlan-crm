import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Building, Plus } from "lucide-react-native";
import { photoUrl, supabase } from "../../lib/supabase";
import { useColors } from "../../lib/theme";
import { formatHuf } from "../../lib/format";
import { PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "../../lib/labels";
import { Badge, EmptyState, ErrorBox, Loading, SearchInput } from "../../components/ui";

type Property = {
  id: string;
  address: string;
  city: string | null;
  price: number | null;
  size_sqm: number | null;
  rooms: number | null;
  half_rooms: number | null;
  status: string;
  listing_type: string | null;
  property_type: string | null;
  cover: string | null;
};

const TYPE_FILTERS = [
  { key: "all", label: "Mind" },
  { key: "sale", label: "Eladó" },
  { key: "rent", label: "Kiadó" },
] as const;

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
  rented: "neutral",
};

export default function PropertiesScreen() {
  const c = useColors();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]["key"]>("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [items, setItems] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let q = supabase
      .from("properties")
      .select("id, address, city, price, size_sqm, rooms, half_rooms, status, listing_type, property_type")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    const term = query.trim().replace(/[%,()]/g, "");
    if (term) q = q.or(`address.ilike.%${term}%,city.ilike.%${term}%`);
    if (typeFilter !== "all") q = q.eq("listing_type", typeFilter);
    if (onlyAvailable) q = q.in("status", ["available", "reserved"]);
    const { data, error: err } = await q;
    if (err) {
      setError("Nem sikerült betölteni az ingatlanokat.");
      return;
    }
    const rows = data ?? [];
    // Borítókép: ingatlanonként a legelső (legkisebb pozíciójú) fotó
    const covers = new Map<string, string>();
    if (rows.length) {
      const { data: photos } = await supabase
        .from("property_photos")
        .select("property_id, path, position")
        .in(
          "property_id",
          rows.map((r) => r.id),
        )
        .order("position", { ascending: true });
      for (const p of photos ?? []) if (!covers.has(p.property_id)) covers.set(p.property_id, photoUrl(p.path));
    }
    setError(null);
    setItems(rows.map((r) => ({ ...r, cover: covers.get(r.id) ?? null })) as Property[]);
  }, [query, typeFilter, onlyAvailable]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const chip = (active: boolean) => [styles.chip, { borderColor: c.border, backgroundColor: active ? c.accent : c.surface }];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <SearchInput placeholder="Cím vagy település" value={query} onChangeText={setQuery} />
        <View style={styles.filters}>
          {TYPE_FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setTypeFilter(f.key)} style={chip(typeFilter === f.key)}>
              <Text style={{ color: typeFilter === f.key ? "#fff" : c.text, fontWeight: "600" }}>{f.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setOnlyAvailable((v) => !v)} style={chip(onlyAvailable)}>
            <Text style={{ color: onlyAvailable ? "#fff" : c.text, fontWeight: "600" }}>Csak elérhető</Text>
          </Pressable>
        </View>
      </View>

      {error ? <ErrorBox message={error} onRetry={load} /> : null}

      {items === null && !error ? (
        <Loading />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 12 }}
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
          ListEmptyComponent={
            <EmptyState title="Nincs találat" text="Új ingatlant a + gombbal vehetsz fel, akár a helyszínen fotózva." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/property/[id]", params: { id: item.id } })}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: c.surface, borderColor: c.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              {item.cover ? (
                <Image source={item.cover} style={styles.cover} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.cover, styles.noPhoto, { backgroundColor: c.bg }]}>
                  <Building color={c.subtle} size={32} />
                </View>
              )}
              <View style={styles.body}>
                <Text style={[styles.price, { color: c.text }]}>
                  {formatHuf(item.price, item.listing_type === "rent")}
                </Text>
                <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={2}>
                  {item.address}
                  {item.city ? `, ${item.city}` : ""}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {[
                    item.property_type ? PROPERTY_TYPE_LABELS[item.property_type] : null,
                    item.size_sqm ? `${item.size_sqm} m²` : null,
                    item.rooms ? `${item.rooms}${item.half_rooms ? ` + ${item.half_rooms} fél` : ""} szoba` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                  <Badge label={PROPERTY_STATUS_LABELS[item.status] ?? item.status} tone={STATUS_TONE[item.status] ?? "neutral"} />
                  {item.listing_type ? <Badge label={item.listing_type === "rent" ? "Kiadó" : "Eladó"} tone="accent" /> : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        accessibilityLabel="Új ingatlan"
        onPress={() => router.push("/property/new")}
        style={[styles.fab, { backgroundColor: c.accent }]}
      >
        <Plus color="#fff" size={26} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: 16, paddingBottom: 8, gap: 10 },
  filters: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cover: { width: "100%", aspectRatio: 16 / 9 },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  body: { padding: 12, gap: 4 },
  price: { fontSize: 18, fontWeight: "800" },
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

import { useCallback, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Share2 } from "lucide-react-native";
import { photoUrl, SITE_URL, supabase } from "../../lib/supabase";
import { useColors } from "../../lib/theme";
import { formatHuf } from "../../lib/format";
import {
  CONDITION_LABELS,
  HEATING_LABELS,
  LISTING_TYPE_LABELS,
  PARKING_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  floorLabel,
} from "../../lib/labels";
import { Button, Card, ErrorBox, Loading, SectionTitle } from "../../components/ui";

type Property = {
  id: string;
  address: string;
  price: number | null;
  size_sqm: number | null;
  status: string;
  ai_description: string | null;
  features: { notes?: string } | null;
  listing_type: string | null;
  property_type: string | null;
  city: string | null;
  postal_code: string | null;
  plot_sqm: number | null;
  rooms: number | null;
  half_rooms: number | null;
  floor: number | null;
  building_floors: number | null;
  year_built: number | null;
  condition: string | null;
  heating: string[] | null;
  energy_rating: string | null;
  parking: string | null;
  balcony_sqm: number | null;
  has_lift: boolean | null;
  has_air_conditioning: boolean | null;
  has_garden_access: boolean | null;
  is_furnished: boolean | null;
  monthly_common_cost: number | null;
};

const COLUMNS =
  "id, address, price, size_sqm, status, ai_description, features, listing_type, property_type, city, postal_code, plot_sqm, rooms, half_rooms, floor, building_floors, year_built, condition, heating, energy_rating, parking, balcony_sqm, has_lift, has_air_conditioning, has_garden_access, is_furnished, monthly_common_cost";

const yesNo = (v: boolean | null) => (v === true ? "Igen" : v === false ? "Nem" : null);

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [p, setP] = useState<Property | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const width = Dimensions.get("window").width;

  const load = useCallback(async () => {
    const [pRes, phRes] = await Promise.all([
      supabase.from("properties").select(COLUMNS).eq("id", id).maybeSingle(),
      supabase.from("property_photos").select("path").eq("property_id", id).order("position", { ascending: true }),
    ]);
    if (pRes.error || !pRes.data) {
      setError("Nem sikerült betölteni az ingatlant.");
      return;
    }
    setError(null);
    setP(pRes.data as unknown as Property);
    setPhotos((phRes.data ?? []).map((x) => photoUrl(x.path)));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setStatus(status: string) {
    if (!p) return;
    setP({ ...p, status });
    const { error: err } = await supabase.from("properties").update({ status }).eq("id", p.id);
    if (err) {
      setError("Nem sikerült módosítani az állapotot.");
      load();
    }
  }

  async function share() {
    if (!p) return;
    const url = SITE_URL ? `${SITE_URL.replace(/\/$/, "")}/p/${p.id}` : "";
    await Share.share({
      title: p.address,
      message: [p.address, formatHuf(p.price, p.listing_type === "rent"), url].filter(Boolean).join("\n"),
    }).catch(() => {});
  }

  if (error && !p) return <ErrorBox message={error} onRetry={load} />;
  if (!p) return <Loading />;

  const isRent = p.listing_type === "rent";
  const details: [string, string | number | null][] = [
    ["Hirdetés", p.listing_type ? LISTING_TYPE_LABELS[p.listing_type] : null],
    ["Típus", p.property_type ? PROPERTY_TYPE_LABELS[p.property_type] : null],
    ["Település", [p.postal_code, p.city].filter(Boolean).join(" ") || null],
    ["Alapterület", p.size_sqm ? `${p.size_sqm} m²` : null],
    ["Szobák", p.rooms != null ? (p.half_rooms ? `${p.rooms} + ${p.half_rooms} fél` : p.rooms) : null],
    ["Telekméret", p.plot_sqm ? `${p.plot_sqm} m²` : null],
    ["Állapot", p.condition ? CONDITION_LABELS[p.condition] : null],
    ["Építés éve", p.year_built],
    ["Emelet", floorLabel(p.floor)],
    ["Épület szintjei", p.building_floors],
    ["Fűtés", (p.heating ?? []).map((h) => HEATING_LABELS[h]).filter(Boolean).join(", ") || null],
    ["Energetika", p.energy_rating],
    ["Parkolás", p.parking ? PARKING_LABELS[p.parking] : null],
    ["Erkély", p.balcony_sqm ? `${p.balcony_sqm} m²` : null],
    ["Lift", yesNo(p.has_lift)],
    ["Klíma", yesNo(p.has_air_conditioning)],
    ["Kertkapcsolat", yesNo(p.has_garden_access)],
    ["Bútorozott", yesNo(p.is_furnished)],
    ["Közös költség", p.monthly_common_cost ? formatHuf(p.monthly_common_cost, true) : null],
  ];
  const visible = details.filter(([, v]) => v != null && v !== "");

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <Stack.Screen options={{ title: p.address }} />
      {photos.length ? (
        <FlatList
          horizontal
          pagingEnabled
          data={photos}
          keyExtractor={(u, i) => `${i}-${u}`}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View>
              <Image source={item} style={{ width, height: width * 0.66 }} contentFit="cover" />
              <View style={styles.counter}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                  {index + 1} / {photos.length}
                </Text>
              </View>
            </View>
          )}
        />
      ) : null}

      <View style={{ padding: 16 }}>
        {error ? <ErrorBox message={error} /> : null}
        <Text style={[styles.price, { color: c.text }]}>{formatHuf(p.price, isRent)}</Text>
        <Text style={{ color: c.text, fontSize: 17, marginTop: 2 }}>{p.address}</Text>

        <View style={{ marginTop: 14 }}>
          <Button label="Megosztás ügyféllel" variant="secondary" icon={<Share2 size={18} color={c.text} />} onPress={share} />
        </View>

        <SectionTitle>Állapot</SectionTitle>
        <View style={styles.chips}>
          {Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setStatus(value)}
              style={[styles.chip, { borderColor: c.border, backgroundColor: p.status === value ? c.accent : c.surface }]}
            >
              <Text style={{ color: p.status === value ? "#fff" : c.text, fontWeight: "600" }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {visible.length ? (
          <>
            <SectionTitle>Adatok</SectionTitle>
            <Card style={styles.grid}>
              {visible.map(([label, value]) => (
                <View key={label} style={styles.cell}>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
                  <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{String(value)}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {p.ai_description ? (
          <>
            <SectionTitle>Leírás</SectionTitle>
            <Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>{p.ai_description}</Text>
          </>
        ) : null}

        {p.features?.notes ? (
          <>
            <SectionTitle>Belső jegyzet</SectionTitle>
            <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>{p.features.notes}</Text>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  counter: { position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  price: { fontSize: 24, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  cell: { width: "50%", paddingRight: 8, gap: 2 },
});

import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Camera, ChevronDown, ChevronUp, ImagePlus, X } from "lucide-react-native";
import { useColors } from "../lib/theme";
import {
  CONDITION_LABELS,
  ENERGY_RATINGS,
  HEATING_LABELS,
  PARKING_LABELS,
  PROPERTY_TYPE_GROUPS,
  PROPERTY_TYPE_LABELS,
} from "../lib/labels";
import { pickPhotos, type PickedPhoto } from "../lib/photos";
import { Button, ErrorBox } from "./ui";

// Az űrlap állapota: a számmezők szövegként (gépelés közben), mentéskor alakítjuk át.
export type PropertyFormValues = {
  listing_type: "sale" | "rent";
  property_type: string | null;
  address: string;
  city: string;
  postal_code: string;
  price: string;
  size_sqm: string;
  rooms: string;
  half_rooms: string;
  plot_sqm: string;
  floor: string; // "" = nincs megadva, "-1" = szuterén, "0" = földszint
  building_floors: string;
  year_built: string;
  condition: string | null;
  heating: string[];
  energy_rating: string | null;
  parking: string | null;
  balcony_sqm: string;
  has_lift: boolean | null;
  has_air_conditioning: boolean | null;
  has_garden_access: boolean | null;
  is_furnished: boolean | null;
  monthly_common_cost: string;
  min_lease_months: string;
  pets_allowed: boolean | null;
  notes: string;
};

export const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  listing_type: "sale",
  property_type: null,
  address: "",
  city: "",
  postal_code: "",
  price: "",
  size_sqm: "",
  rooms: "",
  half_rooms: "",
  plot_sqm: "",
  floor: "",
  building_floors: "",
  year_built: "",
  condition: null,
  heating: [],
  energy_rating: null,
  parking: null,
  balcony_sqm: "",
  has_lift: null,
  has_air_conditioning: null,
  has_garden_access: null,
  is_furnished: null,
  monthly_common_cost: "",
  min_lease_months: "",
  pets_allowed: null,
  notes: "",
};

// Az adatbázis-oszlopok, amiket az űrlap kezel (a szerkesztő ezeket tölti be)
export const PROPERTY_FORM_COLUMNS =
  "id, address, price, size_sqm, features, listing_type, property_type, city, postal_code, plot_sqm, rooms, half_rooms, floor, building_floors, year_built, condition, heating, energy_rating, parking, balcony_sqm, has_lift, has_air_conditioning, has_garden_access, is_furnished, monthly_common_cost, min_lease_months, pets_allowed";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v == null ? "" : String(v));
const bool = (v: unknown) => (typeof v === "boolean" ? v : null);

export function groupDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function valuesFromRow(row: Row): PropertyFormValues {
  const features = (row.features ?? {}) as { notes?: string };
  return {
    listing_type: row.listing_type === "rent" ? "rent" : "sale",
    property_type: (row.property_type as string) ?? null,
    address: str(row.address),
    city: str(row.city),
    postal_code: str(row.postal_code),
    price: row.price != null ? groupDigits(String(Math.round(Number(row.price)))) : "",
    size_sqm: str(row.size_sqm),
    rooms: str(row.rooms),
    half_rooms: str(row.half_rooms),
    plot_sqm: str(row.plot_sqm),
    floor: str(row.floor),
    building_floors: str(row.building_floors),
    year_built: str(row.year_built),
    condition: (row.condition as string) ?? null,
    heating: Array.isArray(row.heating) ? (row.heating as string[]) : [],
    energy_rating: (row.energy_rating as string) ?? null,
    parking: (row.parking as string) ?? null,
    balcony_sqm: str(row.balcony_sqm),
    has_lift: bool(row.has_lift),
    has_air_conditioning: bool(row.has_air_conditioning),
    has_garden_access: bool(row.has_garden_access),
    is_furnished: bool(row.is_furnished),
    monthly_common_cost: row.monthly_common_cost != null ? groupDigits(String(Math.round(Number(row.monthly_common_cost)))) : "",
    min_lease_months: str(row.min_lease_months),
    pets_allowed: bool(row.pets_allowed),
    notes: features.notes ?? "",
  };
}

function num(value: string): number | null {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() && Number.isFinite(n) ? n : null;
}

function int(value: string): number | null {
  const n = num(value);
  return n == null ? null : Math.trunc(n);
}

// Ugyanazok a szabályok, mint a webes CRM-ben (parseListingFields): a csak bérlésre
// vonatkozó mezők eladó ingatlannál üresek maradnak.
export function payloadFromValues(v: PropertyFormValues, existingFeatures: Row = {}) {
  const rent = v.listing_type === "rent";
  const notes = v.notes.trim();
  const { notes: _old, ...otherFeatures } = existingFeatures;
  return {
    address: v.address.trim(),
    price: num(v.price),
    size_sqm: num(v.size_sqm),
    listing_type: v.listing_type,
    property_type: v.property_type,
    city: v.city.trim() || null,
    postal_code: v.postal_code.trim() || null,
    plot_sqm: num(v.plot_sqm),
    rooms: int(v.rooms),
    half_rooms: int(v.half_rooms),
    floor: int(v.floor),
    building_floors: int(v.building_floors),
    year_built: int(v.year_built),
    condition: v.condition,
    heating: v.heating,
    energy_rating: v.energy_rating,
    parking: v.parking,
    balcony_sqm: num(v.balcony_sqm),
    has_lift: v.has_lift,
    has_air_conditioning: v.has_air_conditioning,
    has_garden_access: v.has_garden_access,
    is_furnished: v.is_furnished,
    monthly_common_cost: num(v.monthly_common_cost),
    min_lease_months: rent ? int(v.min_lease_months) : null,
    pets_allowed: rent ? v.pets_allowed : null,
    features: notes ? { ...otherFeatures, notes } : otherFeatures,
  };
}

// Hány kiegészítő adat van kitöltve (a "További részletek" fejlécén mutatjuk)
function detailCount(v: PropertyFormValues): number {
  return [
    v.postal_code,
    v.half_rooms,
    v.plot_sqm,
    v.floor,
    v.building_floors,
    v.year_built,
    v.energy_rating,
    v.parking,
    v.balcony_sqm,
    v.monthly_common_cost,
    v.heating.length ? "x" : "",
    v.has_lift,
    v.has_air_conditioning,
    v.has_garden_access,
    v.is_furnished,
    v.listing_type === "rent" ? v.min_lease_months : "",
    v.listing_type === "rent" ? v.pets_allowed : null,
  ].filter((x) => x !== "" && x != null).length;
}

export function PropertyForm({
  initial,
  submitLabel,
  onSubmit,
  error,
  busy,
  photos,
  onPhotosChange,
  detailsInitiallyOpen = false,
}: {
  initial: PropertyFormValues;
  submitLabel: string;
  onSubmit: (values: PropertyFormValues) => void;
  error: string | null;
  busy: boolean;
  // Csak új ingatlannál: a mentés előtt kiválasztott fotók
  photos?: PickedPhoto[];
  onPhotosChange?: (photos: PickedPhoto[]) => void;
  detailsInitiallyOpen?: boolean;
}) {
  const c = useColors();
  const [v, setV] = useState<PropertyFormValues>(initial);
  const [typeOpen, setTypeOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(detailsInitiallyOpen);
  const set = <K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const rent = v.listing_type === "rent";
  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }];
  const chip = (active: boolean) => [styles.chip, { borderColor: c.border, backgroundColor: active ? c.accent : c.surface }];
  const chipText = (active: boolean) => ({ color: active ? "#fff" : c.text, fontWeight: "600" as const });
  const label = (text: string) => <Text style={[styles.label, { color: c.text }]}>{text}</Text>;

  // Egyválasztós chip-sor; az aktív chipre újra koppintva törlődik a választás
  function choice(key: "condition" | "energy_rating" | "parking", options: [string, string][]) {
    return (
      <View style={styles.chips}>
        {options.map(([value, text]) => (
          <Pressable key={value} onPress={() => set(key, v[key] === value ? null : value)} style={chip(v[key] === value)}>
            <Text style={chipText(v[key] === value)}>{text}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  // Igen / Nem kapcsoló; az aktívra újra koppintva "nincs megadva" lesz
  function yesNo(key: "has_lift" | "has_air_conditioning" | "has_garden_access" | "is_furnished" | "pets_allowed", text: string) {
    return (
      <View style={styles.yesNoRow}>
        <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{text}</Text>
        {[true, false].map((b) => (
          <Pressable key={String(b)} onPress={() => set(key, v[key] === b ? null : b)} style={chip(v[key] === b)}>
            <Text style={chipText(v[key] === b)}>{b ? "Igen" : "Nem"}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function numberField(key: keyof PropertyFormValues, text: string, opts: { decimal?: boolean; grouped?: boolean; placeholder?: string } = {}) {
    return (
      <View style={{ flex: 1 }}>
        {label(text)}
        <TextInput
          style={input}
          value={v[key] as string}
          onChangeText={(t) =>
            set(key, (opts.grouped ? groupDigits(t) : opts.decimal ? t.replace(/[^\d.,]/g, "") : t.replace(/\D/g, "")) as never)
          }
          keyboardType={opts.decimal ? "decimal-pad" : "number-pad"}
          placeholder={opts.placeholder}
          placeholderTextColor={c.subtle}
        />
      </View>
    );
  }

  const row = (...children: ReactNode[]) => <View style={{ flexDirection: "row", gap: 12 }}>{children}</View>;
  const count = detailCount(v);
  const floorIsUpper = v.floor !== "" && Number(v.floor) > 0;

  async function addPhotos(source: "camera" | "library") {
    const picked = await pickPhotos(source);
    if (picked?.length && onPhotosChange) onPhotosChange([...(photos ?? []), ...picked]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBox message={error} /> : null}

        {photos && onPhotosChange ? (
          <>
            <Text style={[styles.label, { color: c.text, marginTop: 0 }]}>Fotók</Text>
            {photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.map((p, i) => (
                  <View key={`${i}-${p.uri}`}>
                    <Image source={p.uri} style={styles.thumb} contentFit="cover" />
                    {i === 0 ? (
                      <View style={[styles.coverTag, { backgroundColor: c.accent }]}>
                        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Borítókép</Text>
                      </View>
                    ) : null}
                    <Pressable
                      accessibilityLabel="Fotó eltávolítása"
                      hitSlop={8}
                      onPress={() => onPhotosChange(photos.filter((_, j) => j !== i))}
                      style={styles.removeBtn}
                    >
                      <X size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            {row(
              <View key="cam" style={{ flex: 1 }}>
                <Button label="Fotózás" variant="secondary" icon={<Camera size={18} color={c.text} />} onPress={() => addPhotos("camera")} />
              </View>,
              <View key="lib" style={{ flex: 1 }}>
                <Button label="Galériából" variant="secondary" icon={<ImagePlus size={18} color={c.text} />} onPress={() => addPhotos("library")} />
              </View>,
            )}
          </>
        ) : null}

        {label("Hirdetés")}
        <View style={styles.chips}>
          {(["sale", "rent"] as const).map((t) => (
            <Pressable key={t} onPress={() => set("listing_type", t)} style={chip(v.listing_type === t)}>
              <Text style={chipText(v.listing_type === t)}>{t === "rent" ? "Kiadó" : "Eladó"}</Text>
            </Pressable>
          ))}
        </View>

        {label("Típus")}
        <Pressable onPress={() => setTypeOpen(true)} style={[input, styles.select]}>
          <Text style={{ color: v.property_type ? c.text : c.subtle, fontSize: 16 }}>
            {v.property_type ? PROPERTY_TYPE_LABELS[v.property_type] : "Válassz típust"}
          </Text>
          <ChevronDown size={18} color={c.muted} />
        </Pressable>

        {label("Cím *")}
        <TextInput style={input} value={v.address} onChangeText={(t) => set("address", t)} placeholder="pl. Piac utca 10." placeholderTextColor={c.subtle} />

        {row(
          <View key="city" style={{ flex: 2 }}>
            {label("Település")}
            <TextInput style={input} value={v.city} onChangeText={(t) => set("city", t)} placeholder="pl. Debrecen" placeholderTextColor={c.subtle} />
          </View>,
          <View key="zip" style={{ flex: 1 }}>
            {label("Irsz.")}
            <TextInput
              style={input}
              value={v.postal_code}
              onChangeText={(t) => set("postal_code", t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              placeholder="4024"
              placeholderTextColor={c.subtle}
            />
          </View>,
        )}

        {numberField("price", rent ? "Bérleti díj (Ft / hó)" : "Ár (Ft)", {
          grouped: true,
          placeholder: rent ? "pl. 250 000" : "pl. 54 900 000",
        })}

        {row(
          <View key="size" style={{ flex: 1 }}>{numberField("size_sqm", "Alapterület (m²)", { decimal: true })}</View>,
          <View key="rooms" style={{ flex: 1 }}>{numberField("rooms", "Szobák")}</View>,
          <View key="half" style={{ flex: 1 }}>{numberField("half_rooms", "Félszobák")}</View>,
        )}

        {label("Állapot")}
        {choice("condition", Object.entries(CONDITION_LABELS))}

        {label("Megjegyzés")}
        <TextInput
          style={[input, { minHeight: 90, textAlignVertical: "top", paddingTop: 12 }]}
          value={v.notes}
          onChangeText={(t) => set("notes", t)}
          multiline
          placeholder="pl. déli fekvés, csendes utca, azonnal költözhető"
          placeholderTextColor={c.subtle}
        />

        <Pressable
          onPress={() => setDetailsOpen((o) => !o)}
          style={[styles.detailsHeader, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>További részletek</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {count ? `${count} adat kitöltve` : "Fűtés, emelet, energetika, parkolás, felszereltség…"}
            </Text>
          </View>
          {detailsOpen ? <ChevronUp size={20} color={c.muted} /> : <ChevronDown size={20} color={c.muted} />}
        </Pressable>

        {detailsOpen ? (
          <View style={{ gap: 8 }}>
            {label("Emelet")}
            <View style={styles.chips}>
              {[
                ["-1", "Szuterén"],
                ["0", "Földszint"],
              ].map(([value, text]) => (
                <Pressable key={value} onPress={() => set("floor", v.floor === value ? "" : value)} style={chip(v.floor === value)}>
                  <Text style={chipText(v.floor === value)}>{text}</Text>
                </Pressable>
              ))}
              <TextInput
                style={[input, styles.floorInput, floorIsUpper && { borderColor: c.accent }]}
                value={floorIsUpper ? v.floor : ""}
                onChangeText={(t) => set("floor", t.replace(/\D/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="… emelet"
                placeholderTextColor={c.subtle}
              />
            </View>

            {row(
              <View key="bf" style={{ flex: 1 }}>{numberField("building_floors", "Épület szintjei")}</View>,
              <View key="yb" style={{ flex: 1 }}>{numberField("year_built", "Építés éve", { placeholder: "pl. 1985" })}</View>,
            )}

            {row(
              <View key="plot" style={{ flex: 1 }}>{numberField("plot_sqm", "Telekméret (m²)", { decimal: true })}</View>,
              <View key="balc" style={{ flex: 1 }}>{numberField("balcony_sqm", "Erkély (m²)", { decimal: true })}</View>,
            )}

            {label("Fűtés (több is választható)")}
            <View style={styles.chips}>
              {Object.entries(HEATING_LABELS).map(([value, text]) => {
                const active = v.heating.includes(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() => set("heating", active ? v.heating.filter((h) => h !== value) : [...v.heating, value])}
                    style={chip(active)}
                  >
                    <Text style={chipText(active)}>{text}</Text>
                  </Pressable>
                );
              })}
            </View>

            {label("Energetikai besorolás")}
            {choice("energy_rating", ENERGY_RATINGS.map((r) => [r, r]))}

            {label("Parkolás")}
            {choice("parking", Object.entries(PARKING_LABELS))}

            {numberField("monthly_common_cost", "Közös költség (Ft / hó)", { grouped: true })}

            {label("Felszereltség")}
            {yesNo("has_lift", "Lift")}
            {yesNo("has_air_conditioning", "Klíma")}
            {yesNo("has_garden_access", "Kertkapcsolat")}
            {yesNo("is_furnished", "Bútorozott")}

            {rent ? (
              <>
                {label("Bérlés feltételei")}
                {numberField("min_lease_months", "Minimum bérleti idő (hónap)")}
                {yesNo("pets_allowed", "Háziállat hozható")}
              </>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 8 }} />
        <Button
          label={submitLabel}
          loading={busy}
          onPress={() => onSubmit(v)}
        />
      </ScrollView>

      <Modal visible={typeOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTypeOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={[styles.sheetHeader, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Ingatlan típusa</Text>
            <Pressable onPress={() => setTypeOpen(false)} hitSlop={10}>
              <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>Bezár</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
            {PROPERTY_TYPE_GROUPS.map((group) => (
              <View key={group.label} style={{ marginBottom: 16 }}>
                <Text style={{ color: c.muted, fontSize: 13, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" }}>
                  {group.label}
                </Text>
                {Object.entries(group.options).map(([value, text]) => {
                  const active = v.property_type === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        set("property_type", value);
                        setTypeOpen(false);
                      }}
                      style={[styles.option, { borderColor: c.border, backgroundColor: active ? c.accentSoft : c.surface }]}
                    >
                      <Text style={{ color: active ? c.accent : c.text, fontSize: 16, fontWeight: active ? "700" : "400" }}>{text}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  floorInput: { minHeight: 38, width: 110, borderRadius: 999, fontSize: 15 },
  yesNoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  thumb: { width: 104, height: 78, borderRadius: 10 },
  coverTag: { position: "absolute", left: 6, bottom: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
});

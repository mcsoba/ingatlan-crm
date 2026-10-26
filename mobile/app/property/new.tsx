import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Camera, ChevronDown, ImagePlus, X } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { CONDITION_LABELS, PROPERTY_TYPE_GROUPS, PROPERTY_TYPE_LABELS } from "../../lib/labels";
import { pickPhotos, uploadPropertyPhotos, type PickedPhoto } from "../../lib/photos";
import { Button, ErrorBox } from "../../components/ui";

// "54900000" -> "54 900 000" gépelés közben
function groupDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return value.trim() && Number.isFinite(n) ? n : null;
}

export default function NewProperty() {
  const c = useColors();
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [listingType, setListingType] = useState<"sale" | "rent">("sale");
  const [propertyType, setPropertyType] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [rooms, setRooms] = useState("");
  const [condition, setCondition] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos(source: "camera" | "library") {
    const picked = await pickPhotos(source);
    if (picked?.length) setPhotos((prev) => [...prev, ...picked]);
  }

  async function save() {
    if (!address.trim()) {
      setError("A cím megadása kötelező.");
      return;
    }
    if (!profile) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("properties")
      .insert({
        agency_id: profile.agency_id,
        address: address.trim(),
        city: city.trim() || null,
        price: toNumber(price),
        size_sqm: toNumber(size),
        rooms: toNumber(rooms),
        listing_type: listingType,
        property_type: propertyType,
        condition,
        status: "available",
        features: notes.trim() ? { notes: notes.trim() } : {},
      })
      .select("id")
      .single();
    if (err || !data) {
      setBusy(false);
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }

    if (photos.length) {
      setProgress(`Fotók feltöltése… 0 / ${photos.length}`);
      const uploaded = await uploadPropertyPhotos(profile.agency_id, data.id, photos, (done) =>
        setProgress(`Fotók feltöltése… ${done} / ${photos.length}`),
      );
      if (uploaded < photos.length) {
        Alert.alert(
          "Néhány fotó nem töltődött fel",
          `${photos.length - uploaded} kép feltöltése nem sikerült. Az ingatlan adatlapján később újra hozzáadhatod őket.`,
        );
      }
    }

    setBusy(false);
    setProgress(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: "/property/[id]", params: { id: data.id } });
  }

  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }];
  const chip = (active: boolean) => [styles.chip, { borderColor: c.border, backgroundColor: active ? c.accent : c.surface }];
  const chipText = (active: boolean) => ({ color: active ? "#fff" : c.text, fontWeight: "600" as const });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBox message={error} /> : null}

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
                  onPress={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  style={styles.removeBtn}
                >
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="Fotózás" variant="secondary" icon={<Camera size={18} color={c.text} />} onPress={() => addPhotos("camera")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Galériából" variant="secondary" icon={<ImagePlus size={18} color={c.text} />} onPress={() => addPhotos("library")} />
          </View>
        </View>

        <Text style={[styles.label, { color: c.text }]}>Hirdetés</Text>
        <View style={styles.chips}>
          <Pressable onPress={() => setListingType("sale")} style={chip(listingType === "sale")}>
            <Text style={chipText(listingType === "sale")}>Eladó</Text>
          </Pressable>
          <Pressable onPress={() => setListingType("rent")} style={chip(listingType === "rent")}>
            <Text style={chipText(listingType === "rent")}>Kiadó</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: c.text }]}>Típus</Text>
        <Pressable onPress={() => setTypeOpen(true)} style={[input, styles.select]}>
          <Text style={{ color: propertyType ? c.text : c.subtle, fontSize: 16 }}>
            {propertyType ? PROPERTY_TYPE_LABELS[propertyType] : "Válassz típust"}
          </Text>
          <ChevronDown size={18} color={c.muted} />
        </Pressable>

        <Text style={[styles.label, { color: c.text }]}>Cím *</Text>
        <TextInput style={input} value={address} onChangeText={setAddress} placeholder="pl. Piac utca 10." placeholderTextColor={c.subtle} />

        <Text style={[styles.label, { color: c.text }]}>Település</Text>
        <TextInput style={input} value={city} onChangeText={setCity} placeholder="pl. Debrecen" placeholderTextColor={c.subtle} />

        <Text style={[styles.label, { color: c.text }]}>{listingType === "rent" ? "Bérleti díj (Ft / hó)" : "Ár (Ft)"}</Text>
        <TextInput
          style={input}
          value={price}
          onChangeText={(v) => setPrice(groupDigits(v))}
          keyboardType="number-pad"
          placeholder={listingType === "rent" ? "pl. 250 000" : "pl. 54 900 000"}
          placeholderTextColor={c.subtle}
        />

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.text }]}>Alapterület (m²)</Text>
            <TextInput style={input} value={size} onChangeText={setSize} keyboardType="decimal-pad" placeholderTextColor={c.subtle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: c.text }]}>Szobák</Text>
            <TextInput style={input} value={rooms} onChangeText={(v) => setRooms(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholderTextColor={c.subtle} />
          </View>
        </View>

        <Text style={[styles.label, { color: c.text }]}>Állapot</Text>
        <View style={styles.chips}>
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <Pressable key={value} onPress={() => setCondition(condition === value ? null : value)} style={chip(condition === value)}>
              <Text style={chipText(condition === value)}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: c.text }]}>Megjegyzés</Text>
        <TextInput
          style={[input, { minHeight: 90, textAlignVertical: "top", paddingTop: 12 }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="pl. déli fekvés, csendes utca, azonnal költözhető"
          placeholderTextColor={c.subtle}
        />

        <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
          A további részleteket (fűtés, emelet, energetika stb.) később a számítógépes CRM-ben is kiegészítheted.
        </Text>

        <View style={{ height: 8 }} />
        <Button label={progress ?? "Ingatlan mentése"} onPress={save} loading={busy} />
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
                {Object.entries(group.options).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setPropertyType(value);
                      setTypeOpen(false);
                    }}
                    style={[
                      styles.option,
                      { borderColor: c.border, backgroundColor: propertyType === value ? c.accentSoft : c.surface },
                    ]}
                  >
                    <Text style={{ color: propertyType === value ? c.accent : c.text, fontSize: 16, fontWeight: propertyType === value ? "700" : "400" }}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
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

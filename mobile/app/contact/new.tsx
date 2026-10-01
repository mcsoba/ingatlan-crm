import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { Button, Card, ErrorBox } from "../../components/ui";

const SOURCES: Record<string, string> = {
  phone: "Telefon",
  walk_in: "Betérő",
  referral: "Ajánlás",
  website: "Weboldal",
  other: "Egyéb",
};

type Duplicate = { id: string; name: string };

export default function NewContact() {
  const c = useColors();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("phone");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);

  async function findDuplicate(): Promise<Duplicate | null> {
    const digits = phone.replace(/\D/g, "");
    const filters: string[] = [];
    // Az utolsó 9 számjegy alapján (a +36 / 06 előtag ne számítson), számjegyenként
    // helyettesítő karakterrel, hogy a tárolt szám szóközei/kötőjelei se zavarjanak.
    if (digits.length >= 7) filters.push(`phone.ilike.%${digits.slice(-9).split("").join("%")}%`);
    if (email.trim()) filters.push(`email.ilike.${email.trim().replace(/[%,()]/g, "")}`);
    if (!filters.length) return null;
    const { data } = await supabase
      .from("contacts")
      .select("id, name")
      .is("deleted_at", null)
      .or(filters.join(","))
      .limit(1);
    return data?.[0] ?? null;
  }

  async function save(force = false) {
    if (!name.trim()) {
      setError("A név megadása kötelező.");
      return;
    }
    if (!profile) return;
    setBusy(true);
    setError(null);
    if (!force) {
      const dup = await findDuplicate();
      if (dup) {
        setDuplicate(dup);
        setBusy(false);
        return;
      }
    }
    const { data, error: err } = await supabase
      .from("contacts")
      .insert({
        agency_id: profile.agency_id,
        owner_id: profile.id,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source,
        status: "new",
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    setBusy(false);
    if (err || !data) {
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: "/contact/[id]", params: { id: data.id } });
  }

  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBox message={error} /> : null}

        {duplicate ? (
          <Card style={{ gap: 10, borderColor: c.warning, backgroundColor: c.warningSoft }}>
            <Text style={{ color: c.text, fontWeight: "700" }}>
              Már van ilyen kontakt: {duplicate.name}
            </Text>
            <Text style={{ color: c.muted }}>Ugyanez a telefonszám vagy e-mail cím szerepel nálatok.</Text>
            <Button
              label="Megnyitom a meglévőt"
              onPress={() => router.replace({ pathname: "/contact/[id]", params: { id: duplicate.id } })}
            />
            <Button label="Mégis újként mentem" variant="secondary" onPress={() => save(true)} />
          </Card>
        ) : null}

        <Text style={[styles.label, { color: c.text }]}>Név *</Text>
        <TextInput style={input} value={name} onChangeText={setName} placeholder="pl. Kovács Anna" placeholderTextColor={c.subtle} autoFocus />

        <Text style={[styles.label, { color: c.text }]}>Telefonszám</Text>
        <TextInput style={input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+36 30 123 4567" placeholderTextColor={c.subtle} />

        <Text style={[styles.label, { color: c.text }]}>E-mail</Text>
        <TextInput style={input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={c.subtle} />

        <Text style={[styles.label, { color: c.text }]}>Honnan jött?</Text>
        <View style={styles.chips}>
          {Object.entries(SOURCES).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setSource(value)}
              style={[styles.chip, { borderColor: c.border, backgroundColor: source === value ? c.accent : c.surface }]}
            >
              <Text style={{ color: source === value ? "#fff" : c.text, fontWeight: "600" }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: c.text }]}>Mit keres? (megjegyzés)</Text>
        <TextInput
          style={[input, { minHeight: 90, textAlignVertical: "top", paddingTop: 12 }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="pl. 2 szobás lakás Debrecen belvárosában, 60 M Ft-ig"
          placeholderTextColor={c.subtle}
        />

        <View style={{ height: 8 }} />
        <Button label="Kontakt mentése" onPress={() => save(false)} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});

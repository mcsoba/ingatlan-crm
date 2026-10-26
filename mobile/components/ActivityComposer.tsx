import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useColors } from "../lib/theme";
import { ACTIVITY_TYPE_LABELS } from "../lib/labels";
import { Button, Card } from "./ui";

const TYPES = ["note", "call", "viewing", "reminder"] as const;
const DUE_OPTIONS = [
  { key: "none", label: "Nincs határidő" },
  { key: "today", label: "Ma" },
  { key: "tomorrow", label: "Holnap" },
  { key: "week", label: "1 hét múlva" },
] as const;

type DueKey = (typeof DUE_OPTIONS)[number]["key"];

function dueFor(key: DueKey): string | null {
  if (key === "none") return null;
  const d = new Date();
  if (key === "tomorrow") d.setDate(d.getDate() + 1);
  if (key === "week") d.setDate(d.getDate() + 7);
  // Mai teendőnél a következő egész óra (23 óra után a nap vége, hogy ne csússzon holnapra),
  // a többinél reggel 9 óra
  if (key === "today") {
    if (d.getHours() >= 23) d.setHours(23, 59, 0, 0);
    else d.setHours(d.getHours() + 1, 0, 0, 0);
  } else d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

const PLACEHOLDERS: Record<string, string> = {
  call: "Miről beszéltetek?",
  viewing: "Melyik ingatlan, mikor, benyomások…",
  reminder: "Mit kell megtenni?",
  note: "Írd ide…",
};

// Jegyzet / hívás / megtekintés / emlékeztető gyors felvétele egy kontakthoz vagy üzlethez.
export function ActivityComposer({
  contactId,
  dealId,
  onSaved,
  defaultType = "note",
  defaultDue = "none",
  saveLabel = "Mentés",
}: {
  contactId?: string | null;
  dealId?: string | null;
  onSaved: () => void;
  defaultType?: (typeof TYPES)[number];
  defaultDue?: DueKey;
  saveLabel?: string;
}) {
  const c = useColors();
  const { profile } = useAuth();
  const [type, setType] = useState<(typeof TYPES)[number]>(defaultType);
  const [due, setDue] = useState<DueKey>(defaultDue);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!content.trim() || !profile) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("activities").insert({
      agency_id: profile.agency_id,
      contact_id: contactId ?? null,
      deal_id: dealId ?? null,
      type,
      content: content.trim(),
      due_at: dueFor(due),
    });
    setBusy(false);
    if (err) {
      setError("Nem sikerült menteni. Próbáld újra.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setContent("");
    setDue(defaultDue);
    onSaved();
  }

  const chip = (active: boolean) => [
    styles.chip,
    { borderColor: c.border, backgroundColor: active ? c.accent : c.surface },
  ];

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.chips}>
        {TYPES.map((t) => (
          <Pressable key={t} onPress={() => setType(t)} style={chip(type === t)}>
            <Text style={{ color: type === t ? "#fff" : c.text, fontWeight: "600", fontSize: 13 }}>
              {ACTIVITY_TYPE_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        multiline
        placeholder={PLACEHOLDERS[type]}
        placeholderTextColor={c.subtle}
        value={content}
        onChangeText={setContent}
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
      />
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
        Határidő (teendőként megjelenik a Ma fülön)
      </Text>
      <View style={styles.chips}>
        {DUE_OPTIONS.map((o) => (
          <Pressable key={o.key} onPress={() => setDue(o.key)} style={chip(due === o.key)}>
            <Text style={{ color: due === o.key ? "#fff" : c.text, fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      <Button label={saveLabel} onPress={save} loading={busy} disabled={!content.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 84, fontSize: 16, textAlignVertical: "top" },
});

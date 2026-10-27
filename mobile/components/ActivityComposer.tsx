import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useColors } from "../lib/theme";
import { ACTIVITY_TYPE_LABELS, RECURRENCE_LABELS } from "../lib/labels";
import { useTeam } from "../lib/team";
import { notifyAssignee } from "../lib/notify";
import { Button, Card } from "./ui";
import { ChoiceChips, FieldLabel } from "./ChoiceChips";
import { DueTimePicker, defaultDueOn } from "./DueTimePicker";

const TYPES = ["note", "call", "viewing", "reminder"] as const;
type DueKey = "none" | "today" | "tomorrow" | "week";
const DUE_DAYS: Record<Exclude<DueKey, "none">, number> = { today: 0, tomorrow: 1, week: 7 };

function initialDue(key: DueKey): Date | null {
  return key === "none" ? null : defaultDueOn(DUE_DAYS[key]);
}

const PLACEHOLDERS: Record<string, string> = {
  call: "Miről beszéltetek?",
  viewing: "Melyik ingatlan, mikor, benyomások…",
  reminder: "Mit kell megtenni?",
  note: "Írd ide…",
};

// Jegyzet / hívás / megtekintés / emlékeztető felvétele egy kontakthoz vagy
// üzlethez — ugyanazokkal a lehetőségekkel, mint a weben (pontos határidő,
// felelős, ismétlődés).
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
  const team = useTeam();
  const [type, setType] = useState<(typeof TYPES)[number]>(defaultType);
  const [due, setDue] = useState<Date | null>(() => initialDue(defaultDue));
  const [assignee, setAssignee] = useState<string | null>(profile?.id ?? null);
  const [recurrence, setRecurrence] = useState<string>("none");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!content.trim() || !profile) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("activities")
      .insert({
        agency_id: profile.agency_id,
        contact_id: contactId ?? null,
        deal_id: dealId ?? null,
        type,
        content: content.trim(),
        due_at: due ? due.toISOString() : null,
        recurrence: due ? recurrence : "none",
        ...(assignee ? { assigned_to: assignee } : {}),
      })
      .select("id")
      .single();
    setBusy(false);
    if (err) {
      setError("Nem sikerült menteni. Próbáld újra.");
      return;
    }
    if (assignee && assignee !== profile.id) notifyAssignee("task", data.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setContent("");
    setDue(initialDue(defaultDue));
    setRecurrence("none");
    setAssignee(profile.id);
    onSaved();
  }

  return (
    <Card style={{ gap: 10 }}>
      <ChoiceChips
        options={TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t]! }))}
        value={type}
        onChange={setType}
      />
      <TextInput
        multiline
        placeholder={PLACEHOLDERS[type]}
        placeholderTextColor={c.subtle}
        value={content}
        onChangeText={setContent}
        style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
      />
      <FieldLabel>Határidő (teendőként megjelenik a Ma fülön)</FieldLabel>
      <DueTimePicker value={due} onChange={setDue} />

      {due && team.length > 1 ? (
        <>
          <FieldLabel>Kinek a feladata?</FieldLabel>
          <ChoiceChips
            options={team.map((m) => ({ value: m.id, label: m.id === profile?.id ? `${m.name} (én)` : m.name }))}
            value={assignee}
            onChange={setAssignee}
          />
        </>
      ) : null}

      {due ? (
        <>
          <FieldLabel>Ismétlődés</FieldLabel>
          <ChoiceChips
            options={Object.entries(RECURRENCE_LABELS).map(([value, label]) => ({ value, label }))}
            value={recurrence}
            onChange={setRecurrence}
          />
        </>
      ) : null}

      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      <Button label={saveLabel} onPress={save} loading={busy} disabled={!content.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 84, fontSize: 16, textAlignVertical: "top" },
});

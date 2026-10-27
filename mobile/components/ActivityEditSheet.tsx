import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { X } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useColors } from "../lib/theme";
import { ACTIVITY_TYPE_LABELS, RECURRENCE_LABELS } from "../lib/labels";
import { useTeam } from "../lib/team";
import { notifyAssignee } from "../lib/notify";
import { confirmDestructive } from "../lib/confirm";
import { Button } from "./ui";
import { ChoiceChips, FieldLabel } from "./ChoiceChips";
import { DueTimePicker } from "./DueTimePicker";

export type EditableActivity = {
  id: string;
  type: string;
  content: string;
  due_at: string | null;
  done: boolean;
  assigned_to?: string | null;
  recurrence?: string | null;
};

const TYPES = ["note", "call", "viewing", "reminder"];

// Meglévő bejegyzés szerkesztése: szöveg, típus, pontos határidő, felelős,
// ismétlődés, kész/nyitott, törlés — mint a weben.
export function ActivityEditSheet({
  activity,
  onClose,
}: {
  activity: EditableActivity | null;
  onClose: (changed: boolean) => void;
}) {
  if (!activity) return null;
  // key: másik bejegyzés megnyitásakor tiszta kezdőállapot
  return <EditForm key={activity.id} activity={activity} onClose={onClose} />;
}

function EditForm({ activity, onClose }: { activity: EditableActivity; onClose: (changed: boolean) => void }) {
  const c = useColors();
  const { profile } = useAuth();
  const team = useTeam();
  const [type, setType] = useState(activity.type);
  const [content, setContent] = useState(activity.content);
  const [due, setDue] = useState<Date | null>(activity.due_at ? new Date(activity.due_at) : null);
  const [assignee, setAssignee] = useState<string | null>(activity.assigned_to ?? null);
  const [recurrence, setRecurrence] = useState(activity.recurrence ?? "none");
  const [done, setDone] = useState(activity.done);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChecklist = activity.type === "checklist";

  async function save() {
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("activities")
      .update({
        type,
        content: content.trim(),
        due_at: due ? due.toISOString() : null,
        recurrence: due ? recurrence : "none",
        done,
        ...(assignee ? { assigned_to: assignee } : {}),
        // Új határidőnél újra szóljon az emlékeztető
        ...(due && due.toISOString() !== activity.due_at ? { push_sent_at: null } : {}),
      })
      .eq("id", activity.id);
    setBusy(false);
    if (err) {
      setError("Nem sikerült menteni. Próbáld újra.");
      return;
    }
    if (assignee && assignee !== activity.assigned_to && assignee !== profile?.id) notifyAssignee("task", activity.id);
    onClose(true);
  }

  function confirmDelete() {
    confirmDestructive("Törlöd ezt a bejegyzést?", "Ez nem vonható vissza.", "Törlés", async () => {
      const { error: err } = await supabase.from("activities").delete().eq("id", activity.id);
      if (err) setError("Nem sikerült törölni.");
      else onClose(true);
    });
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.head, { borderBottomColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>Bejegyzés szerkesztése</Text>
          <Pressable onPress={() => onClose(false)} hitSlop={10}>
            <X size={24} color={c.muted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {!isChecklist ? (
            <ChoiceChips options={TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t]! }))} value={type} onChange={setType} />
          ) : null}
          <TextInput
            multiline
            value={content}
            onChangeText={setContent}
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          />

          <FieldLabel>Állapot</FieldLabel>
          <ChoiceChips
            options={[
              { value: "open", label: "Nyitott" },
              { value: "done", label: "✓ Kész" },
            ]}
            value={done ? "done" : "open"}
            onChange={(v) => setDone(v === "done")}
          />

          <FieldLabel>Határidő</FieldLabel>
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

          {due && !isChecklist ? (
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
          <Button label="Mentés" onPress={save} loading={busy} disabled={!content.trim()} />
          <Pressable onPress={confirmDelete} style={styles.delete}>
            <Text style={{ color: c.danger, fontWeight: "700" }}>Bejegyzés törlése</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 96, fontSize: 16, textAlignVertical: "top" },
  delete: { alignItems: "center", paddingVertical: 14 },
});

import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { useColors } from "../../../lib/theme";
import { CONTACT_SOURCE_LABELS, CONTACT_STATUS_LABELS } from "../../../lib/labels";
import { CONTACT_STATUS_HELP } from "../../../lib/process";
import { useTeam } from "../../../lib/team";
import { notifyAssignee } from "../../../lib/notify";
import { confirmDestructive } from "../../../lib/confirm";
import { Button, ErrorBox, Loading } from "../../../components/ui";
import { ChoiceChips } from "../../../components/ChoiceChips";

// Kontakt adatainak szerkesztése — a webes kontakt-űrlap mezői + felelős.
export default function EditContact() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { profile } = useAuth();
  const team = useTeam();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("other");
  const [status, setStatus] = useState("new");
  const [owner, setOwner] = useState<string>("");
  const [originalOwner, setOriginalOwner] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("contacts")
      .select("name, phone, email, source, status, owner_id, notes")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Nem sikerült betölteni a kontaktot.");
          return;
        }
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        setSource(data.source ?? "other");
        setStatus(data.status ?? "new");
        setOwner(data.owner_id ?? "");
        setOriginalOwner(data.owner_id ?? null);
        setNotes(data.notes ?? "");
        setLoaded(true);
      });
  }, [id]);

  async function save() {
    if (!name.trim()) {
      setError("A név megadása kötelező.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("contacts")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source,
        status,
        owner_id: owner || null,
        notes: notes.trim() || null,
      })
      .eq("id", id);
    setBusy(false);
    if (err) {
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }
    if (owner && owner !== originalOwner && owner !== profile?.id) notifyAssignee("contact", id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }

  function remove() {
    confirmDestructive(
      "Törlöd ezt a kontaktot?",
      "A Lomtárba kerül, onnan a weben 30 napig visszaállítható.",
      "Törlés",
      async () => {
        const { error: err } = await supabase.rpc("soft_delete_contacts", { p_ids: [id] });
        if (err) {
          setError("Nem sikerült törölni.");
          return;
        }
        router.dismissTo("/contacts");
      },
    );
  }

  if (error && !loaded) return <ErrorBox message={error} />;
  if (!loaded) return <Loading />;

  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBox message={error} /> : null}

        <Text style={[styles.label, { color: c.text }]}>Név *</Text>
        <TextInput style={input} value={name} onChangeText={setName} />

        <Text style={[styles.label, { color: c.text }]}>Telefonszám</Text>
        <TextInput style={input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={[styles.label, { color: c.text }]}>E-mail</Text>
        <TextInput style={input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

        <Text style={[styles.label, { color: c.text }]}>Állapot</Text>
        <ChoiceChips
          options={Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          value={status}
          onChange={setStatus}
        />
        {CONTACT_STATUS_HELP[status] ? <Text style={{ color: c.muted, fontSize: 13 }}>{CONTACT_STATUS_HELP[status]}</Text> : null}

        <Text style={[styles.label, { color: c.text }]}>Honnan jött?</Text>
        <ChoiceChips
          options={Object.entries(CONTACT_SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
          value={source}
          onChange={setSource}
        />

        {team.length > 1 ? (
          <>
            <Text style={[styles.label, { color: c.text }]}>Felelős értékesítő</Text>
            <ChoiceChips
              options={[
                { value: "", label: "Nincs kijelölve" },
                ...team.map((m) => ({ value: m.id, label: m.id === profile?.id ? `${m.name} (én)` : m.name })),
              ]}
              value={owner}
              onChange={setOwner}
            />
          </>
        ) : null}

        <Text style={[styles.label, { color: c.text }]}>Mit keres? (megjegyzés)</Text>
        <TextInput
          style={[input, { minHeight: 110, textAlignVertical: "top", paddingTop: 12 }]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Button label="Mentés" onPress={save} loading={busy} />
        <Pressable onPress={remove} style={styles.delete}>
          <Text style={{ color: c.danger, fontWeight: "700" }}>Kontakt törlése</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  delete: { alignItems: "center", paddingVertical: 16 },
});

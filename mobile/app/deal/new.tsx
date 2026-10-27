import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useColors } from "../../lib/theme";
import { notifyAssignee } from "../../lib/notify";
import { Button, Card, ErrorBox } from "../../components/ui";
import { DealForm, dealPayload, type DealFormValues } from "../../components/DealForm";

// Új üzlet nyitása egy kontakthoz (a pipeline első szakaszába kerül, mint a weben)
export default function NewDeal() {
  const { contactId, contactName } = useLocalSearchParams<{ contactId: string; contactName?: string }>();
  const c = useColors();
  const { profile } = useAuth();
  const [values, setValues] = useState<DealFormValues>({
    dealType: "sale",
    property: null,
    ownerId: profile?.id ?? "",
    amount: "",
    rate: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!profile || !contactId) return;
    setBusy(true);
    setError(null);
    const { data: firstStage } = await supabase.from("pipeline_stages").select("id").order("position").limit(1).maybeSingle();
    if (!firstStage) {
      setBusy(false);
      setError("Nincs pipeline-szakasz beállítva.");
      return;
    }
    const { data, error: err } = await supabase
      .from("deals")
      .insert({ agency_id: profile.agency_id, contact_id: contactId, stage_id: firstStage.id, ...dealPayload({ ...values, ownerId: values.ownerId || profile.id }) })
      .select("id")
      .single();
    setBusy(false);
    if (err || !data) {
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }
    if (values.ownerId && values.ownerId !== profile.id) notifyAssignee("deal", data.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: "/deal/[id]", params: { id: data.id } });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBox message={error} /> : null}
        <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent }}>
          <Text style={{ color: c.text }}>
            Üzlet nyitása neki: <Text style={{ fontWeight: "800" }}>{contactName ?? "kontakt"}</Text>
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
            Az üzlet a pipeline első szakaszába kerül. Ár és jutalék később is megadható.
          </Text>
        </Card>
        <DealForm values={values} onChange={setValues} />
        <Button label="Üzlet létrehozása" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

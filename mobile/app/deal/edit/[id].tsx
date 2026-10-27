import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { useColors } from "../../../lib/theme";
import { notifyAssignee } from "../../../lib/notify";
import { confirmDestructive } from "../../../lib/confirm";
import { Button, ErrorBox, Loading } from "../../../components/ui";
import { DealForm, dealPayload, type DealFormValues } from "../../../components/DealForm";

// Üzlet adatainak szerkesztése: típus, ingatlan, felelős, ár, jutalék, jegyzet
export default function EditDeal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { profile } = useAuth();
  const [values, setValues] = useState<DealFormValues | null>(null);
  const [originalOwner, setOriginalOwner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("deals")
      .select("deal_type, property_id, owner_id, deal_amount, commission_rate, notes, properties(address)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Nem sikerült betölteni az üzletet.");
          return;
        }
        const prop = data.properties as unknown as { address: string } | null;
        setOriginalOwner(data.owner_id ?? null);
        setValues({
          dealType: data.deal_type === "rent" ? "rent" : "sale",
          property: data.property_id ? { id: data.property_id, address: prop?.address ?? "Ingatlan" } : null,
          ownerId: data.owner_id ?? "",
          amount: data.deal_amount != null ? String(data.deal_amount) : "",
          rate: data.commission_rate != null ? String(data.commission_rate) : "",
          notes: data.notes ?? "",
        });
      });
  }, [id]);

  async function save() {
    if (!values) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("deals")
      .update({ ...dealPayload(values), updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (err) {
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }
    if (values.ownerId && values.ownerId !== originalOwner && values.ownerId !== profile?.id) notifyAssignee("deal", id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }

  function remove() {
    confirmDestructive("Törlöd ezt az üzletet?", "A Lomtárba kerül, onnan a weben 30 napig visszaállítható.", "Törlés", async () => {
      const { error: err } = await supabase.rpc("soft_delete_deal", { p_id: id });
      if (err) {
        setError("Nem sikerült törölni.");
        return;
      }
      router.dismissTo("/pipeline");
    });
  }

  if (error && !values) return <ErrorBox message={error} />;
  if (!values) return <Loading />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {error ? <ErrorBox message={error} /> : null}
        <DealForm values={values} onChange={setValues} />
        <Button label="Mentés" onPress={save} loading={busy} />
        <Pressable onPress={remove} style={styles.delete}>
          <Text style={{ color: c.danger, fontWeight: "700" }}>Üzlet törlése</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  delete: { alignItems: "center", paddingVertical: 16 },
});

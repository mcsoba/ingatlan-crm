import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useColors } from "../lib/theme";
import { ActivityComposer } from "./ActivityComposer";

// "Mi a következő lépés?" — egy teendő lezárása vagy egy elakadt ügy után
// azonnal felkínáljuk a következő teendő ütemezését, hogy egy ügyfél se
// maradjon következő lépés nélkül.
export function NextStepSheet({
  visible,
  title = "Mi a következő lépés?",
  subtitle,
  contactId,
  dealId,
  onClose,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  onClose: (saved: boolean) => void;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: "800" }}>{title}</Text>
            {subtitle ? <Text style={{ color: c.muted, fontSize: 15 }}>{subtitle}</Text> : null}
            <Text style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>
              Ütemezd a következő teendőt, így emlékeztetőt kapsz, és az ügy nem akad el.
            </Text>
          </View>
          <ActivityComposer
            contactId={contactId}
            dealId={dealId}
            defaultType="call"
            defaultDue="tomorrow"
            saveLabel="Következő lépés mentése"
            onSaved={() => onClose(true)}
          />
          <Pressable onPress={() => onClose(false)} hitSlop={8} style={{ alignSelf: "center", padding: 12 }}>
            <Text style={{ color: c.muted, fontSize: 15, fontWeight: "600" }}>Most nincs további teendő</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useColors } from "../lib/theme";
import { formatHuf } from "../lib/format";
import { useTeam } from "../lib/team";
import { ChoiceChips } from "./ChoiceChips";
import { PropertyPicker, type PickedProperty } from "./PropertyPicker";

export type DealFormValues = {
  dealType: "sale" | "rent";
  property: PickedProperty | null;
  ownerId: string;
  amount: string;
  rate: string;
  notes: string;
};

function parseNumber(s: string): number | null {
  const t = s.replace(/[\s ]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// A deals tábla frissítendő mezői — a webes createDeal / updateDeal* műveletekkel egyezően
export function dealPayload(v: DealFormValues) {
  return {
    deal_type: v.dealType,
    property_id: v.property?.id ?? null,
    owner_id: v.ownerId || null,
    deal_amount: parseNumber(v.amount),
    commission_rate: parseNumber(v.rate),
    notes: v.notes.trim() || null,
  };
}

export function DealForm({ values, onChange }: { values: DealFormValues; onChange: (v: DealFormValues) => void }) {
  const c = useColors();
  const { profile } = useAuth();
  const team = useTeam();
  const set = <K extends keyof DealFormValues>(k: K, val: DealFormValues[K]) => onChange({ ...values, [k]: val });

  const amount = parseNumber(values.amount);
  const rate = parseNumber(values.rate);
  const commission = amount != null && rate != null ? Math.round((amount * rate) / 100) : null;
  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }];

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.text }]}>Típus</Text>
      <ChoiceChips
        options={[
          { value: "sale", label: "Eladás" },
          { value: "rent", label: "Bérlés" },
        ]}
        value={values.dealType}
        onChange={(v) => set("dealType", v as "sale" | "rent")}
      />

      <Text style={[styles.label, { color: c.text }]}>Ingatlan</Text>
      <PropertyPicker value={values.property} onChange={(p) => set("property", p)} />

      {team.length > 1 ? (
        <>
          <Text style={[styles.label, { color: c.text }]}>Felelős értékesítő</Text>
          <ChoiceChips
            options={team.map((m) => ({ value: m.id, label: m.id === profile?.id ? `${m.name} (én)` : m.name }))}
            value={values.ownerId}
            onChange={(v) => set("ownerId", v)}
          />
        </>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 2, gap: 8 }}>
          <Text style={[styles.label, { color: c.text }]}>Végleges ár (Ft)</Text>
          <TextInput
            style={input}
            value={values.amount}
            onChangeText={(t) => set("amount", t)}
            keyboardType="numeric"
            placeholder="pl. 45000000"
            placeholderTextColor={c.subtle}
          />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.label, { color: c.text }]}>Jutalék (%)</Text>
          <TextInput
            style={input}
            value={values.rate}
            onChangeText={(t) => set("rate", t)}
            keyboardType="decimal-pad"
            placeholder="pl. 3"
            placeholderTextColor={c.subtle}
          />
        </View>
      </View>
      {commission != null ? (
        <Text style={{ color: c.muted, fontSize: 13 }}>Várható jutalék: {formatHuf(commission)}</Text>
      ) : null}

      <Text style={[styles.label, { color: c.text }]}>Jegyzet az üzlethez</Text>
      <TextInput
        style={[input, { minHeight: 90, textAlignVertical: "top", paddingTop: 12 }]}
        value={values.notes}
        onChangeText={(t) => set("notes", t)}
        multiline
        placeholder="pl. hitelre vásárol, a bank még bírálja"
        placeholderTextColor={c.subtle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
});

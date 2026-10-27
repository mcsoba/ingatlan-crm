import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "../lib/theme";

// Egyválasztós "chip" sor (típus, felelős, ismétlődés, forrás…)
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { borderColor: c.border, backgroundColor: active ? c.accent : c.surface }]}
          >
            <Text style={{ color: active ? "#fff" : c.text, fontWeight: "600", fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{children}</Text>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});

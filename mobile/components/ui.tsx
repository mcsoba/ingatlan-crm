import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Search } from "lucide-react-native";
import { useColors } from "../lib/theme";

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  const c = useColors();
  const bg = variant === "primary" ? c.accent : variant === "danger" ? c.dangerSoft : c.surface;
  const fg = variant === "primary" ? "#fff" : variant === "danger" ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === "secondary" ? c.border : bg },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "success" | "warning" | "danger" }) {
  const c = useColors();
  const map = {
    neutral: [c.bg, c.muted],
    accent: [c.accentSoft, c.accent],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function SearchInput(props: TextInputProps) {
  const c = useColors();
  return (
    <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Search size={18} color={c.muted} />
      <TextInput
        placeholderTextColor={c.subtle}
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.searchInput, { color: c.text }]}
        {...props}
      />
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {text ? <Text style={[styles.emptyText, { color: c.muted }]}>{text}</Text> : null}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.errorBox, { backgroundColor: c.dangerSoft }]}>
      <Text style={{ color: c.danger, fontSize: 14 }}>{message}</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={{ color: c.danger, fontWeight: "700", marginTop: 6 }}>
          Újrapróbálom
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.section, { color: c.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  errorBox: { borderRadius: 12, padding: 14, margin: 16 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 18, marginBottom: 8 },
});

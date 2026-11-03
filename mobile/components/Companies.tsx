import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "../lib/theme";
import { pickCompanies, setSelectedCompany, useCompanies, useSelectedCompany, type Company } from "../lib/companies";

/** Kis, színes cégcímkék (kontakt, üzlet mellett). */
export function CompanyBadges({ ids }: { ids: (string | null | undefined)[] | null | undefined }) {
  const c = useColors();
  const companies = useCompanies();
  const picked = pickCompanies(companies, ids);
  if (!picked.length) return null;
  return (
    <View style={styles.badges}>
      {picked.map((co) => (
        <View key={co.id} style={[styles.badge, { borderColor: c.border }]}>
          <View style={[styles.dot, { backgroundColor: co.color }]} />
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: "600" }}>{co.name}</Text>
        </View>
      ))}
    </View>
  );
}

/** Lista tetején: melyik cég adatait mutassa (a választás minden listára érvényes). */
export function CompanyFilter() {
  const c = useColors();
  const companies = useCompanies();
  const selected = useSelectedCompany();
  if (!companies.length) return null;
  const options: { id: string | null; name: string; color?: string }[] = [{ id: null, name: "Összes cég" }, ...companies];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filter}>
      {options.map((o) => {
        const active = o.id === selected;
        return (
          <Pressable
            key={o.id ?? "all"}
            onPress={() => setSelectedCompany(o.id)}
            style={[styles.filterChip, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accentSoft : c.surface }]}
          >
            {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
            <Text style={{ color: active ? c.accent : c.text, fontSize: 13, fontWeight: "600" }}>{o.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Űrlapban: több cég jelölhető (kontakt) — vagy `single` esetén egy (üzlet, „Nincs” is választható). */
export function CompanyChips({
  value,
  onChange,
  single = false,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
}) {
  const c = useColors();
  const companies = useCompanies();
  if (!companies.length) return null;

  function toggle(co: Company) {
    if (single) onChange(value.includes(co.id) ? [] : [co.id]);
    else onChange(value.includes(co.id) ? value.filter((v) => v !== co.id) : [...value, co.id]);
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: c.text }]}>{single ? "Cég (kinek a nevében)" : "Cég(ek)"}</Text>
      <View style={styles.badges}>
        {companies.map((co) => {
          const active = value.includes(co.id);
          return (
            <Pressable
              key={co.id}
              onPress={() => toggle(co)}
              style={[styles.formChip, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accentSoft : c.surface }]}
            >
              <View style={[styles.dot, { backgroundColor: co.color }]} />
              <Text style={{ color: active ? c.accent : c.text, fontWeight: "600" }}>{co.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  filter: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  formChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 8 },
});

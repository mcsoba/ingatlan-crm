import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Building2, ChevronRight, X } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useColors } from "../lib/theme";
import { formatHuf } from "../lib/format";
import { LISTING_TYPE_LABELS } from "../lib/labels";
import { SearchInput } from "./ui";

export type PickedProperty = { id: string; address: string };
type Row = { id: string; address: string; price: number | null; listing_type: string | null };

// Ingatlan kiválasztása üzlethez (keresés címre). "Nincs ingatlan" is választható.
export function PropertyPicker({
  value,
  onChange,
}: {
  value: PickedProperty | null;
  onChange: (p: PickedProperty | null) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    let q = supabase
      .from("properties")
      .select("id, address, price, listing_type")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (query.trim()) q = q.ilike("address", `%${query.trim().replace(/[%,()]/g, "")}%`);
    q.then(({ data }) => setRows((data ?? []) as Row[]));
  }, [open, query]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.field, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Building2 size={18} color={c.muted} />
        <Text style={{ color: value ? c.text : c.subtle, flex: 1, fontSize: 16 }} numberOfLines={1}>
          {value?.address ?? "Nincs ingatlan kiválasztva"}
        </Text>
        <ChevronRight size={18} color={c.subtle} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={[styles.head, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: "800" }}>Ingatlan kiválasztása</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <X size={24} color={c.muted} />
            </Pressable>
          </View>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <SearchInput placeholder="Keresés címre…" value={query} onChangeText={setQuery} />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Pressable
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                style={[styles.row, { borderColor: c.border, backgroundColor: c.surface, marginBottom: 8 }]}
              >
                <Text style={{ color: c.muted, fontWeight: "600" }}>Nincs ingatlan (később is megadható)</Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange({ id: item.id, address: item.address });
                  setOpen(false);
                }}
                style={[
                  styles.row,
                  { borderColor: item.id === value?.id ? c.accent : c.border, backgroundColor: c.surface },
                ]}
              >
                <Text style={{ color: c.text, fontWeight: "600" }} numberOfLines={1}>
                  {item.address}
                </Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {item.listing_type ? `${LISTING_TYPE_LABELS[item.listing_type] ?? ""} · ` : ""}
                  {formatHuf(item.price, item.listing_type === "rent")}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
});

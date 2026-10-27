import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarClock, X } from "lucide-react-native";
import { useColors } from "../lib/theme";

// Határidő választó: gyors nap-gombok (Ma, Holnap, …), gyors időpontok
// (9:00, 11:00, …) és pontos dátum + óra:perc a telefon saját választójával.

const DAY_CHIPS = [
  { key: "today", label: "Ma", days: 0 },
  { key: "tomorrow", label: "Holnap", days: 1 },
  { key: "after", label: "Holnapután", days: 2 },
  { key: "week", label: "1 hét múlva", days: 7 },
] as const;

const TIME_CHIPS = ["09:00", "11:00", "14:00", "17:00"];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function withTime(day: Date, hh: number, mm: number): Date {
  const d = new Date(day);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Új határidő alapértéke egy adott napra: ma a következő egész óra
// (23 óra után a nap vége), más napokon reggel 9.
export function defaultDueOn(daysFromToday: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  if (daysFromToday === 0) {
    if (d.getHours() >= 23) d.setHours(23, 59, 0, 0);
    else d.setHours(d.getHours() + 1, 0, 0, 0);
  } else d.setHours(9, 0, 0, 0);
  return d;
}

export function formatDueLong(d: Date): string {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  const day =
    diff === 0
      ? "Ma"
      : diff === 1
        ? "Holnap"
        : d.toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "short" });
  return `${day}, ${d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}`;
}

export function DueTimePicker({
  value,
  onChange,
  allowNone = true,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  allowNone?: boolean;
}) {
  const c = useColors();
  const [iosMode, setIosMode] = useState<null | "datetime">(null);
  const [iosDraft, setIosDraft] = useState<Date>(value ?? defaultDueOn(0));

  const activeDay = value ? Math.round((startOfDay(value) - startOfDay(new Date())) / 86400000) : null;
  const activeTime = value ? value.toTimeString().slice(0, 5) : null;

  const chip = (active: boolean) => [styles.chip, { borderColor: c.border, backgroundColor: active ? c.accent : c.surface }];
  const chipText = (active: boolean) => ({ color: active ? "#fff" : c.text, fontSize: 13, fontWeight: "600" as const });

  function pickDay(days: number) {
    if (value) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      onChange(withTime(d, value.getHours(), value.getMinutes()));
    } else onChange(defaultDueOn(days));
  }

  function pickTime(hhmm: string) {
    const [hh, mm] = hhmm.split(":").map(Number);
    onChange(withTime(value ?? new Date(), hh!, mm!));
  }

  function openExact() {
    const base = value ?? defaultDueOn(0);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: base,
        mode: "date",
        onValueChange: (_e, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            is24Hour: true,
            onValueChange: (_e2, time) => onChange(withTime(date, time.getHours(), time.getMinutes())),
          });
        },
      });
    } else {
      setIosDraft(base);
      setIosMode("datetime");
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.chips}>
        {allowNone ? (
          <Pressable onPress={() => onChange(null)} style={chip(value === null)}>
            <Text style={chipText(value === null)}>Nincs határidő</Text>
          </Pressable>
        ) : null}
        {DAY_CHIPS.map((o) => (
          <Pressable key={o.key} onPress={() => pickDay(o.days)} style={chip(activeDay === o.days)}>
            <Text style={chipText(activeDay === o.days)}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      {value ? (
        <>
          <View style={styles.chips}>
            {TIME_CHIPS.map((t) => (
              <Pressable key={t} onPress={() => pickTime(t)} style={chip(activeTime === t)}>
                <Text style={chipText(activeTime === t)}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={openExact} style={[styles.summary, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
            <CalendarClock size={18} color={c.accent} />
            <Text style={{ color: c.text, fontWeight: "700", flex: 1 }}>{formatDueLong(value)}</Text>
            <Text style={{ color: c.accent, fontWeight: "700" }}>Pontos idő</Text>
          </Pressable>
          {Platform.OS === "web" ? (
            <WebExactInput key={value.getTime()} value={value} onChange={onChange} />
          ) : null}
        </>
      ) : (
        <Pressable onPress={openExact} hitSlop={6}>
          <Text style={{ color: c.accent, fontWeight: "600", fontSize: 13 }}>Másik nap és pontos időpont…</Text>
        </Pressable>
      )}

      <Modal visible={iosMode !== null} transparent animationType="slide" onRequestClose={() => setIosMode(null)}>
        <Pressable style={styles.backdrop} onPress={() => setIosMode(null)} />
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={styles.sheetHead}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "800" }}>Határidő</Text>
            <Pressable onPress={() => setIosMode(null)} hitSlop={10}>
              <X size={22} color={c.muted} />
            </Pressable>
          </View>
          {iosMode ? (
            <DateTimePicker
              value={iosDraft}
              mode="datetime"
              display="spinner"
              locale="hu-HU"
              minuteInterval={5}
              onValueChange={(_e, d) => setIosDraft(d)}
              style={{ alignSelf: "stretch" }}
            />
          ) : null}
          <Pressable
            onPress={() => {
              onChange(iosDraft);
              setIosMode(null);
            }}
            style={[styles.done, { backgroundColor: c.accent }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Kész</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// Böngészős előnézetben nincs natív választó: egyszerű szöveges mező
function WebExactInput({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const c = useColors();
  const pad = (n: number) => String(n).padStart(2, "0");
  const initial = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  const [text, setText] = useState(initial);
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        const m = t.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
        if (m) onChange(new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!));
      }}
      placeholder="ÉÉÉÉ-HH-NN ÓÓ:PP"
      style={[styles.webInput, { borderColor: c.border, color: c.text }]}
    />
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  summary: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { padding: 16, paddingBottom: 32, borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 8 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  done: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  webInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15 },
});

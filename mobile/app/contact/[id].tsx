import { useCallback, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Briefcase, Mail, MessageSquare, Pencil, Phone } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useColors } from "../../lib/theme";
import { initials } from "../../lib/format";
import { CONTACT_SOURCE_LABELS, CONTACT_STATUS_LABELS } from "../../lib/labels";
import { callPhone, sendEmail, smsPhone } from "../../lib/contact-actions";
import { Badge, Button, Card, ErrorBox, Loading, SectionTitle } from "../../components/ui";
import { ActivityComposer } from "../../components/ActivityComposer";
import { NextStepSheet } from "../../components/NextStepSheet";
import { CONTACT_STATUS_HELP } from "../../lib/process";
import { memberName, useTeam } from "../../lib/team";
import { useAuth } from "../../context/AuthContext";
import { ActivityEditSheet } from "../../components/ActivityEditSheet";
import { ACTIVITY_COLUMNS, ActivityHistory, type HistoryActivity } from "../../components/ActivityHistory";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  owner_id: string | null;
};
type Activity = HistoryActivity;
type Deal = {
  id: string;
  deal_type: string;
  pipeline_stages: { name: string } | null;
  properties: { address: string } | null;
};

export default function ContactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const team = useTeam();
  const { profile } = useAuth();

  const load = useCallback(async () => {
    const [cRes, aRes, dRes] = await Promise.all([
      supabase.from("contacts").select("id, name, phone, email, status, notes, source, owner_id").eq("id", id).maybeSingle(),
      supabase
        .from("activities")
        .select(ACTIVITY_COLUMNS)
        .eq("contact_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("deals")
        .select("id, deal_type, pipeline_stages(name), properties(address)")
        .eq("contact_id", id)
        .is("deleted_at", null),
    ]);
    if (cRes.error || !cRes.data) {
      setError("Nem sikerült betölteni a kontaktot.");
      return;
    }
    setError(null);
    setContact(cRes.data as Contact);
    setActivities((aRes.data ?? []) as Activity[]);
    setDeals((dRes.data ?? []) as unknown as Deal[]);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function setStatus(status: string) {
    if (!contact) return;
    setContact({ ...contact, status });
    const { error: err } = await supabase.from("contacts").update({ status }).eq("id", contact.id);
    if (err) {
      setError("Nem sikerült módosítani az állapotot.");
      load();
    }
  }

  async function toggleDone(a: Activity) {
    setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)));
    const { error: err } = await supabase.from("activities").update({ done: !a.done }).eq("id", a.id);
    if (err) load();
    else if (!a.done) setSheetOpen(true);
  }

  if (error && !contact) return <ErrorBox message={error} onRetry={load} />;
  if (!contact) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={c.accent}
        />
      }
    >
      <Stack.Screen
        options={{
          title: contact.name,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Kontakt szerkesztése"
              hitSlop={10}
              onPress={() => router.push({ pathname: "/contact/edit/[id]", params: { id: contact.id } })}
              style={{ padding: 4 }}
            >
              <Pencil size={22} color={c.accent} />
            </Pressable>
          ),
        }}
      />
      {error ? <ErrorBox message={error} /> : null}

      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
          <Text style={{ color: c.accent, fontWeight: "800", fontSize: 22 }}>{initials(contact.name)}</Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{contact.name}</Text>
        {contact.phone ? <Text style={{ color: c.muted }}>{contact.phone}</Text> : null}
        {contact.email ? <Text style={{ color: c.muted }}>{contact.email}</Text> : null}
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
          Felelős: {memberName(team, contact.owner_id, profile?.id)}
          {contact.source ? ` · ${CONTACT_SOURCE_LABELS[contact.source] ?? contact.source}` : ""}
        </Text>
      </View>

      <View style={styles.actions}>
        <ActionButton
          label="Hívás"
          icon={<Phone color={c.success} size={22} />}
          bg={c.successSoft}
          disabled={!contact.phone}
          onPress={() => callPhone(contact.phone!)}
        />
        <ActionButton
          label="SMS"
          icon={<MessageSquare color={c.accent} size={22} />}
          bg={c.accentSoft}
          disabled={!contact.phone}
          onPress={() => smsPhone(contact.phone!)}
        />
        <ActionButton
          label="E-mail"
          icon={<Mail color={c.warning} size={22} />}
          bg={c.warningSoft}
          disabled={!contact.email}
          onPress={() => sendEmail(contact.email!)}
        />
      </View>

      <SectionTitle>Állapot</SectionTitle>
      <View style={styles.chips}>
        {Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setStatus(value)}
            style={[styles.chip, { borderColor: c.border, backgroundColor: contact.status === value ? c.accent : c.surface }]}
          >
            <Text style={{ color: contact.status === value ? "#fff" : c.text, fontWeight: "600" }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {CONTACT_STATUS_HELP[contact.status] ? (
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>{CONTACT_STATUS_HELP[contact.status]}</Text>
      ) : null}

      {contact.notes ? (
        <>
          <SectionTitle>Megjegyzés</SectionTitle>
          <Card>
            <Text style={{ color: c.text, lineHeight: 21 }}>{contact.notes}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Üzletek</SectionTitle>
      {deals.length ? (
        <>
          {deals.map((d) => (
            <Pressable key={d.id} onPress={() => router.push({ pathname: "/deal/[id]", params: { id: d.id } })}>
              <Card style={{ marginBottom: 8, gap: 4 }}>
                <Text style={{ color: c.text, fontWeight: "600" }}>{d.properties?.address ?? "Ingatlan nélkül"}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Badge label={d.pipeline_stages?.name ?? "—"} tone="accent" />
                  <Badge label={d.deal_type === "rent" ? "Bérlés" : "Eladás"} />
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      ) : (
        <Text style={{ color: c.muted, marginBottom: 8 }}>
          Ha komoly érdeklődő, nyiss neki üzletet, így végigkövethető a pipeline-on.
        </Text>
      )}
      <Button
        label="Új üzlet nyitása"
        variant="secondary"
        icon={<Briefcase size={18} color={c.text} />}
        onPress={() => router.push({ pathname: "/deal/new", params: { contactId: contact.id, contactName: contact.name } })}
      />
      <Pressable onPress={() => router.push({ pathname: "/contact/edit/[id]", params: { id: contact.id } })} style={{ alignItems: "center", paddingVertical: 12 }}>
        <Text style={{ color: c.accent, fontWeight: "600" }}>Adatok szerkesztése (név, telefon, felelős…)</Text>
      </Pressable>

      <SectionTitle>Jegyzet vagy teendő rögzítése</SectionTitle>
      <ActivityComposer contactId={contact.id} onSaved={load} />

      <SectionTitle>Előzmények</SectionTitle>
      <ActivityHistory activities={activities} emptyText="Még nincs bejegyzés." onToggleDone={toggleDone} onEdit={setEditing} />
      <ActivityEditSheet
        activity={editing}
        onClose={(changed) => {
          setEditing(null);
          if (changed) load();
        }}
      />

      <NextStepSheet
        visible={sheetOpen}
        title="Kész! Mi a következő lépés?"
        subtitle={contact.name}
        contactId={contact.id}
        onClose={() => {
          setSheetOpen(false);
          load();
        }}
      />
    </ScrollView>
  );
}

function ActionButton({
  label,
  icon,
  bg,
  onPress,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  bg: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  head: { alignItems: "center", gap: 4, marginTop: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  name: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 28, marginTop: 18 },
  action: { alignItems: "center", gap: 6 },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});

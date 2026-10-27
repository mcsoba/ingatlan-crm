import { Pressable, Text, View } from "react-native";
import { Pencil, Repeat } from "lucide-react-native";
import { useColors } from "../lib/theme";
import { formatDue, isOverdue } from "../lib/format";
import { ACTIVITY_TYPE_LABELS } from "../lib/labels";
import { memberName, useTeam } from "../lib/team";
import { useAuth } from "../context/AuthContext";
import { Badge, Card } from "./ui";
import type { EditableActivity } from "./ActivityEditSheet";

export type HistoryActivity = EditableActivity & { created_at: string };

export const ACTIVITY_COLUMNS = "id, type, content, due_at, done, created_at, assigned_to, recurrence";

// Előzmények lista: a bejegyzésre koppintva szerkeszthető, a határidő-jelvényre
// koppintva késznek jelölhető.
export function ActivityHistory({
  activities,
  emptyText,
  onToggleDone,
  onEdit,
}: {
  activities: HistoryActivity[];
  emptyText: string;
  onToggleDone: (a: HistoryActivity) => void;
  onEdit: (a: HistoryActivity) => void;
}) {
  const c = useColors();
  const team = useTeam();
  const { profile } = useAuth();

  if (activities.length === 0) return <Text style={{ color: c.muted }}>{emptyText}</Text>;

  return (
    <>
      {activities.map((a) => (
        <Pressable key={a.id} onPress={() => onEdit(a)}>
          <Card style={{ marginBottom: 8, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge label={ACTIVITY_TYPE_LABELS[a.type] ?? a.type} tone="accent" />
              {a.due_at ? (
                <Pressable onPress={() => onToggleDone(a)} hitSlop={8}>
                  <Badge
                    label={a.done ? "✓ Kész" : `${formatDue(a.due_at)} – jelöld késznek`}
                    tone={a.done ? "success" : isOverdue(a.due_at) ? "danger" : "warning"}
                  />
                </Pressable>
              ) : (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {new Date(a.created_at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}
                </Text>
              )}
              {a.recurrence && a.recurrence !== "none" ? <Repeat size={14} color={c.muted} /> : null}
              <View style={{ marginLeft: "auto" }}>
                <Pencil size={14} color={c.subtle} />
              </View>
            </View>
            <Text
              style={{
                color: a.done ? c.muted : c.text,
                lineHeight: 21,
                textDecorationLine: a.done ? "line-through" : "none",
              }}
            >
              {a.content}
            </Text>
            {a.due_at && a.assigned_to && a.assigned_to !== profile?.id ? (
              <Text style={{ color: c.muted, fontSize: 12 }}>Felelős: {memberName(team, a.assigned_to)}</Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </>
  );
}

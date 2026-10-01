import { Tabs } from "expo-router";
import { CalendarCheck, Building, Kanban, Users } from "lucide-react-native";
import { useColors } from "../../lib/theme";

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ma", tabBarIcon: ({ color }) => <CalendarCheck color={color} size={22} /> }} />
      <Tabs.Screen name="contacts" options={{ title: "Kontaktok", tabBarIcon: ({ color }) => <Users color={color} size={22} /> }} />
      <Tabs.Screen name="properties" options={{ title: "Ingatlanok", tabBarIcon: ({ color }) => <Building color={color} size={22} /> }} />
      <Tabs.Screen name="pipeline" options={{ title: "Pipeline", tabBarIcon: ({ color }) => <Kanban color={color} size={22} /> }} />
    </Tabs>
  );
}

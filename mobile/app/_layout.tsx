import { useEffect } from "react";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { Platform, useColorScheme, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { Loading } from "../components/ui";
import { useColors } from "../lib/theme";

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const c = useColors();
  const scheme = useColorScheme();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center" }}>
        <Loading />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {session && Platform.OS !== "web" ? <NotificationOpener /> : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="contact/[id]" options={{ title: "Kontakt" }} />
          <Stack.Screen name="contact/new" options={{ title: "Új kontakt", presentation: "modal" }} />
          <Stack.Screen name="property/new" options={{ title: "Új ingatlan", presentation: "modal" }} />
          <Stack.Screen name="property/edit/[id]" options={{ title: "Ingatlan szerkesztése", presentation: "modal" }} />
          <Stack.Screen name="property/[id]" options={{ title: "Ingatlan" }} />
          <Stack.Screen name="deal/[id]" options={{ title: "Üzlet" }} />
          <Stack.Screen name="deal/new" options={{ title: "Új üzlet", presentation: "modal" }} />
          <Stack.Screen name="deal/edit/[id]" options={{ title: "Üzlet szerkesztése", presentation: "modal" }} />
          <Stack.Screen name="contact/edit/[id]" options={{ title: "Kontakt szerkesztése", presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

// Értesítésre koppintva a hozzá tartozó képernyő nyílik meg (pl. az új érdeklődő).
// Csak natívon: a böngészős előnézetben az expo-notifications ezt nem támogatja.
function NotificationOpener() {
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastResponse) return;
    const url = lastResponse.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) {
      router.push(url as never);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  }, [lastResponse]);
  return null;
}

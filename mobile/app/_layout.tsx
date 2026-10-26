import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, View } from "react-native";
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
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

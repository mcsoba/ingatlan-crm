import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Building2 } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { Button, ErrorBox } from "../components/ui";
import { useColors } from "../lib/theme";
import { BRAND } from "../lib/brand";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const c = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Add meg az e-mail címed és a jelszavad.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.wrap, { backgroundColor: c.bg }]}
    >
      <View style={styles.inner}>
        {BRAND.logo ? (
          <Image source={BRAND.logo} style={styles.logoImage} resizeMode="contain" />
        ) : (
          <View style={[styles.logo, { backgroundColor: c.accent }]}>
            <Building2 color="#fff" size={28} strokeWidth={2.25} />
          </View>
        )}
        <Text style={[styles.title, { color: c.text }]}>{BRAND.name}</Text>
        <Text style={[styles.sub, { color: c.muted }]}>
          Lépj be ugyanazzal a fiókkal, amit a számítógépen használsz.
        </Text>

        {error ? <ErrorBox message={error} /> : null}

        <TextInput
          style={input}
          placeholder="E-mail cím"
          placeholderTextColor={c.subtle}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={input}
          placeholder="Jelszó"
          placeholderTextColor={c.subtle}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        <Button label="Belépés" onPress={submit} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center" },
  inner: { paddingHorizontal: 24, gap: 12, width: "100%", maxWidth: 440, alignSelf: "center" },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 8 },
  logoImage: { width: 88, height: 88, alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  sub: { fontSize: 15, textAlign: "center", lineHeight: 21, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
});

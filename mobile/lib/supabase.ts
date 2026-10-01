import "./storage-install";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Hiányzó EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — másold a mobile/.env.example-t .env.local-ra.",
  );
}

// Ugyanaz a Supabase-projekt, mint a webes CRM-é: a sorszintű jogosultságok (RLS)
// gondoskodnak róla, hogy mindenki csak a saját irodája adatait lássa.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Natívon a token-frissítést csak előtérben futtatjuk (az Expo/Supabase ajánlása szerint).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function photoUrl(path: string): string {
  return supabase.storage.from("property-photos").getPublicUrl(path).data.publicUrl;
}

export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "";

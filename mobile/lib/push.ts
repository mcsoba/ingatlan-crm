import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

// Előtérben is jelenjen meg az értesítés (különben csak háttérben látszana)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registeredToken: string | null = null;

// A Ma fül sávja feliratkozik, hogy a regisztráció végén frissüljön
// (az engedélykérés a fül első betöltése után fejeződik be)
const listeners = new Set<(s: PushStatus) => void>();
export function onPushStatusChange(fn: (s: PushStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(s: PushStatus): PushStatus {
  for (const fn of listeners) fn(s);
  return s;
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export type PushStatus = "enabled" | "denied" | "unavailable";

// Engedélykérés + az eszköz Expo push-tokenjének elmentése a bejelentkezett
// felhasználóhoz. Csendben kihagyja, ha nem valódi telefon (pl. webes előnézet),
// vagy ha az app még nincs EAS-projekthez kötve.
export async function registerForPush(): Promise<PushStatus> {
  if (Platform.OS === "web" || !Device.isDevice) return "unavailable";
  const id = projectId();
  if (!id) return "unavailable";

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Értesítések",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return notify("denied");

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS });
    if (error) return "unavailable";
    registeredToken = token;
    return notify("enabled");
  } catch {
    // Pl. Androidon az Expo Go nem támogat távoli értesítést (SDK 53 óta)
    return "unavailable";
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (Platform.OS === "web" || !Device.isDevice || !projectId()) return "unavailable";
  const { status } = await Notifications.getPermissionsAsync();
  // "undetermined": még nem kérdeztük meg — ez nem tiltás, ne jelezzünk
  if (status === "granted") return registeredToken ? "enabled" : "unavailable";
  return status === "denied" ? "denied" : "unavailable";
}

// Kijelentkezéskor: erre az eszközre ne jöjjön több értesítés ennek a felhasználónak
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  await supabase.from("push_tokens").delete().eq("token", registeredToken);
  registeredToken = null;
}

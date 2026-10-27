import { Alert, Platform } from "react-native";

// Megerősítő kérdés romboló műveletek előtt (törlés, elvesztettnek jelölés).
// A böngészős előnézetben az Alert gombjai nem működnek, ott window.confirm.
export function confirmDestructive(title: string, message: string, actionLabel: string, onConfirm: () => void): void {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Mégse", style: "cancel" },
    { text: actionLabel, style: "destructive", onPress: onConfirm },
  ]);
}

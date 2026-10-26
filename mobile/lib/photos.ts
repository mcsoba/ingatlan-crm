import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

export type PickedPhoto = { uri: string; mimeType: string };

// Fotó készítése a kamerával vagy több kép választása a galériából.
// null = a felhasználó megszakította, vagy nem adott engedélyt.
export async function pickPhotos(source: "camera" | "library"): Promise<PickedPhoto[] | null> {
  const perm =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Nincs engedély",
      source === "camera"
        ? "A fotózáshoz engedélyezd a kamerát a telefon beállításaiban."
        : "A képek kiválasztásához engedélyezd a fotók elérését a telefon beállításaiban.",
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    // Mérsékelt tömörítés: hirdetéshez bőven elég, mobilnetről is gyorsan feltölthető
    quality: 0.7,
    exif: false,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 20 });
  if (result.canceled) return null;
  return result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" }));
}

// Feltöltés ugyanabba a tárolóba és ugyanazzal az útvonal-sémával, mint a webes CRM
// (agency_id/property_id/fájl), így a web és a nyilvános ingatlanoldal is látja.
// Visszaadja a sikeresen feltöltött fotók számát.
export async function uploadPropertyPhotos(
  agencyId: string,
  propertyId: string,
  photos: PickedPhoto[],
  onProgress?: (done: number) => void,
): Promise<number> {
  const { count } = await supabase
    .from("property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  let position = count ?? 0;
  let uploaded = 0;

  for (const photo of photos) {
    const ext = photo.mimeType === "image/png" ? "png" : photo.mimeType === "image/heic" ? "heic" : "jpg";
    const path = `${agencyId}/${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    try {
      const body = await (await fetch(photo.uri)).arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from("property-photos")
        .upload(path, body, { contentType: photo.mimeType });
      if (upErr) continue;
      const { error: rowErr } = await supabase
        .from("property_photos")
        .insert({ agency_id: agencyId, property_id: propertyId, path, position });
      if (rowErr) {
        await supabase.storage.from("property-photos").remove([path]);
        continue;
      }
      position++;
      uploaded++;
      onProgress?.(uploaded);
    } catch {
      // Egy sikertelen kép ne akassza meg a többit
    }
  }
  return uploaded;
}

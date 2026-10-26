import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { uploadPropertyPhotos, type PickedPhoto } from "../../lib/photos";
import { EMPTY_PROPERTY_FORM, PropertyForm, payloadFromValues, type PropertyFormValues } from "../../components/PropertyForm";

export default function NewProperty() {
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(values: PropertyFormValues) {
    if (!values.address.trim()) {
      setError("A cím megadása kötelező.");
      return;
    }
    if (!profile) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("properties")
      .insert({ agency_id: profile.agency_id, status: "available", ...payloadFromValues(values) })
      .select("id")
      .single();
    if (err || !data) {
      setBusy(false);
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }

    if (photos.length) {
      setProgress(`Fotók feltöltése… 0 / ${photos.length}`);
      const uploaded = await uploadPropertyPhotos(profile.agency_id, data.id, photos, (done) =>
        setProgress(`Fotók feltöltése… ${done} / ${photos.length}`),
      );
      if (uploaded < photos.length) {
        Alert.alert(
          "Néhány fotó nem töltődött fel",
          `${photos.length - uploaded} kép feltöltése nem sikerült. Az ingatlan adatlapján később újra hozzáadhatod őket.`,
        );
      }
    }

    setBusy(false);
    setProgress(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: "/property/[id]", params: { id: data.id } });
  }

  return (
    <PropertyForm
      initial={EMPTY_PROPERTY_FORM}
      submitLabel={progress ?? "Ingatlan mentése"}
      onSubmit={save}
      error={error}
      busy={busy}
      photos={photos}
      onPhotosChange={setPhotos}
    />
  );
}

import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "../../../lib/supabase";
import { ErrorBox, Loading } from "../../../components/ui";
import {
  PROPERTY_FORM_COLUMNS,
  PropertyForm,
  payloadFromValues,
  valuesFromRow,
  type PropertyFormValues,
} from "../../../components/PropertyForm";

export default function EditProperty() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("properties")
      .select(PROPERTY_FORM_COLUMNS)
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) setLoadError("Nem sikerült betölteni az ingatlant.");
        else setRow(data as Record<string, unknown>);
      });
  }, [id]);

  async function save(values: PropertyFormValues) {
    if (!values.address.trim()) {
      setError("A cím megadása kötelező.");
      return;
    }
    setBusy(true);
    setError(null);
    const features = (row?.features ?? {}) as Record<string, unknown>;
    const { error: err } = await supabase.from("properties").update(payloadFromValues(values, features)).eq("id", id);
    setBusy(false);
    if (err) {
      setError("Nem sikerült menteni. Ellenőrizd az internetkapcsolatot.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }

  if (loadError) return <ErrorBox message={loadError} />;
  if (!row) return <Loading />;

  const initial = valuesFromRow(row);
  return (
    <PropertyForm
      initial={initial}
      submitLabel="Módosítások mentése"
      onSubmit={save}
      error={error}
      busy={busy}
      detailsInitiallyOpen
    />
  );
}

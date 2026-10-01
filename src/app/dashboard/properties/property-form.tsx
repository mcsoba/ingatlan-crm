"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateDescription } from "./actions";
import {
  STATUS_LABELS,
  LISTING_TYPE_LABELS,
  PROPERTY_TYPE_GROUPS,
  PROPERTY_TYPE_LABELS,
  CONDITION_LABELS,
  HEATING_LABELS,
  ENERGY_RATINGS,
  PARKING_LABELS,
  floorLabel,
} from "./constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  inputClass,
  labelClass,
  fieldGroupClass,
  sectionLabelClass,
} from "@/components/ui/styles";
import { queueToast } from "@/components/ui/toast";
import { formatThousands } from "@/components/ui/formatted-number-input";

export type PropertyFormValues = {
  address?: string;
  price?: number | null;
  size_sqm?: number | null;
  status?: string;
  features?: { notes?: string } | null;
  ai_description?: string | null;
  listing_type?: string | null;
  property_type?: string | null;
  city?: string | null;
  postal_code?: string | null;
  plot_sqm?: number | null;
  rooms?: number | null;
  half_rooms?: number | null;
  floor?: number | null;
  building_floors?: number | null;
  year_built?: number | null;
  condition?: string | null;
  heating?: string[] | null;
  energy_rating?: string | null;
  parking?: string | null;
  balcony_sqm?: number | null;
  has_lift?: boolean | null;
  has_air_conditioning?: boolean | null;
  has_garden_access?: boolean | null;
  is_furnished?: boolean | null;
  monthly_common_cost?: number | null;
  min_lease_months?: number | null;
  pets_allowed?: boolean | null;
};

type PropertyFormProps = {
  action: (formData: FormData) => void;
  defaultValues?: PropertyFormValues;
  submitLabel: string;
};

const FLOOR_OPTIONS = [-1, ...Array.from({ length: 21 }, (_, i) => i)];

const yesNo = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "");
const num = (v: number | null | undefined) => (v != null ? String(v) : "");

function YesNoSelect({ name, label, value }: { name: string; label: string; value?: boolean | null }) {
  return (
    <label className={fieldGroupClass}>
      <span className={labelClass}>{label}</span>
      <select name={name} defaultValue={yesNo(value)} className={inputClass}>
        <option value="">Nincs megadva</option>
        <option value="yes">Igen</option>
        <option value="no">Nem</option>
      </select>
    </label>
  );
}

function NumberField({
  name,
  label,
  value,
  step = "1",
  placeholder,
}: {
  name: string;
  label: string;
  value?: number | null;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className={fieldGroupClass}>
      <span className={labelClass}>{label}</span>
      <input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={num(value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

// Readable "Label: value" lines from the current form state, for the AI prompt.
function collectFacts(form: HTMLFormElement): string[] {
  const fd = new FormData(form);
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const facts: string[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) facts.push(`${label}: ${value}`);
  };
  push("Hirdetés típusa", LISTING_TYPE_LABELS[get("listing_type")]);
  push("Ingatlan típusa", PROPERTY_TYPE_LABELS[get("property_type")]);
  push("Település", [get("postal_code"), get("city")].filter(Boolean).join(" "));
  const rooms = get("rooms");
  const half = get("half_rooms");
  if (rooms) push("Szobák", half && half !== "0" ? `${rooms} + ${half} fél` : rooms);
  if (get("plot_sqm")) push("Telekméret", `${get("plot_sqm")} m²`);
  push("Állapot", CONDITION_LABELS[get("condition")]);
  push("Építés éve", get("year_built"));
  if (get("floor") !== "") push("Emelet", floorLabel(Number(get("floor"))));
  push("Épület szintjei", get("building_floors"));
  const heating = fd.getAll("heating").map((h) => HEATING_LABELS[String(h)]).filter(Boolean);
  if (heating.length) push("Fűtés", heating.join(", "));
  push("Energetikai besorolás", get("energy_rating"));
  push("Parkolás", PARKING_LABELS[get("parking")]);
  if (get("balcony_sqm")) push("Erkély/terasz", `${get("balcony_sqm")} m²`);
  const flags: [string, string][] = [
    ["has_lift", "Lift"],
    ["has_air_conditioning", "Légkondicionáló"],
    ["has_garden_access", "Kertkapcsolatos"],
    ["is_furnished", "Bútorozott"],
  ];
  for (const [k, label] of flags) {
    if (get(k) === "yes") push(label, "igen");
    if (get(k) === "no") push(label, "nem");
  }
  if (get("monthly_common_cost")) push("Közös költség", `${get("monthly_common_cost")} Ft/hó`);
  if (get("listing_type") === "rent") {
    if (get("min_lease_months")) push("Minimális bérleti idő", `${get("min_lease_months")} hónap`);
    if (get("pets_allowed") === "yes") push("Kisállat", "hozható");
    if (get("pets_allowed") === "no") push("Kisállat", "nem hozható");
  }
  return facts;
}

export function PropertyForm({
  action,
  defaultValues,
  submitLabel,
}: PropertyFormProps) {
  const d = defaultValues ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [address, setAddress] = useState(d.address ?? "");
  const [price, setPrice] = useState(d.price != null ? String(d.price) : "");
  const [sizeSqm, setSizeSqm] = useState(d.size_sqm != null ? String(d.size_sqm) : "");
  const [listingType, setListingType] = useState(d.listing_type ?? "");
  const [notes, setNotes] = useState(d.features?.notes ?? "");
  const [aiDescription, setAiDescription] = useState(d.ai_description ?? "");
  const [aiError, setAiError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  const isEditing = Boolean(d.address);
  const [isSaving, startSaving] = useTransition();
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Queued before the call: create/update redirect server-side, so this
    // component unmounts before any code after the call would run.
    queueToast({
      title: isEditing ? "Ingatlan elmentve" : "Ingatlan létrehozva",
      variant: "success",
    });
    startSaving(() => {
      action(formData);
    });
  }

  function handleGenerate() {
    setAiError(null);
    const facts = formRef.current ? collectFacts(formRef.current) : [];
    startGenerating(async () => {
      try {
        const description = await generateDescription({
          address,
          price: price ? Number(price.replace(",", ".")) : null,
          size_sqm: sizeSqm ? Number(sizeSqm.replace(",", ".")) : null,
          notes,
          facts,
        });
        setAiDescription(description);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "Hiba történt");
      }
    });
  }

  const heating = new Set(d.heating ?? []);

  return (
    <Card className="max-w-2xl p-5">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Alapadatok ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={fieldGroupClass}>
            <span className={labelClass}>Hirdetés típusa</span>
            <select
              name="listing_type"
              value={listingType}
              onChange={(e) => setListingType(e.target.value)}
              className={inputClass}
            >
              <option value="">Nincs megadva</option>
              {Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={fieldGroupClass}>
            <span className={labelClass}>Ingatlan típusa</span>
            <select name="property_type" defaultValue={d.property_type ?? ""} className={inputClass}>
              <option value="">Nincs megadva</option>
              {PROPERTY_TYPE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {Object.entries(group.options).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <label className={fieldGroupClass}>
          <span className={labelClass}>Cím (utca, házszám)</span>
          <input
            name="address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <label className={fieldGroupClass}>
            <span className={labelClass}>Irányítószám</span>
            <input
              name="postal_code"
              inputMode="numeric"
              maxLength={4}
              defaultValue={d.postal_code ?? ""}
              className={inputClass}
            />
          </label>
          <label className={fieldGroupClass}>
            <span className={labelClass}>Település</span>
            <input name="city" defaultValue={d.city ?? ""} className={inputClass} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={fieldGroupClass}>
            <span className={labelClass}>
              {listingType === "rent" ? "Bérleti díj (Ft/hó)" : "Ár (Ft)"}
            </span>
            <input
              name="price"
              type="text"
              inputMode="numeric"
              value={formatThousands(price)}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
            />
          </label>

          <label className={fieldGroupClass}>
            <span className={labelClass}>Státusz</span>
            <select name="status" defaultValue={d.status ?? "available"} className={inputClass}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className={fieldGroupClass}>
            <span className={labelClass}>Alapterület (m²)</span>
            <input
              name="size_sqm"
              type="number"
              min="0"
              step="1"
              value={sizeSqm}
              onChange={(e) => setSizeSqm(e.target.value)}
              className={inputClass}
            />
          </label>
          <NumberField name="rooms" label="Szobák" value={d.rooms} />
          <NumberField name="half_rooms" label="Félszobák" value={d.half_rooms} />
        </div>

        {/* ── Hirdetési részletek ── */}
        <details className="rounded-lg border border-border p-4" open={isEditing}>
          <summary className={`cursor-pointer ${sectionLabelClass}`}>
            Részletek a hirdetéshez (állapot, fűtés, emelet, felszereltség…)
          </summary>
          <p className="mt-2 text-xs text-muted">
            Nem kötelező, de minél több adat van kitöltve, annál pontosabb az AI-leírás, és
            ezekből készül majd a hirdetés az ingatlanportálokra is.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className={fieldGroupClass}>
              <span className={labelClass}>Állapot</span>
              <select name="condition" defaultValue={d.condition ?? ""} className={inputClass}>
                <option value="">Nincs megadva</option>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField name="year_built" label="Építés éve" value={d.year_built} placeholder="pl. 2015" />
            <label className={fieldGroupClass}>
              <span className={labelClass}>Energetikai besorolás</span>
              <select name="energy_rating" defaultValue={d.energy_rating ?? ""} className={inputClass}>
                <option value="">Nincs megadva</option>
                {ENERGY_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className={fieldGroupClass}>
              <span className={labelClass}>Emelet</span>
              <select name="floor" defaultValue={num(d.floor)} className={inputClass}>
                <option value="">Nincs megadva</option>
                {FLOOR_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </select>
            </label>
            <NumberField name="building_floors" label="Épület szintjei" value={d.building_floors} />
            <NumberField name="plot_sqm" label="Telekméret (m²)" value={d.plot_sqm} />
          </div>

          <fieldset className="mt-4">
            <legend className={labelClass}>Fűtés</legend>
            <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {Object.entries(HEATING_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="heating"
                    value={value}
                    defaultChecked={heating.has(value)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={fieldGroupClass}>
              <span className={labelClass}>Parkolás</span>
              <select name="parking" defaultValue={d.parking ?? ""} className={inputClass}>
                <option value="">Nincs megadva</option>
                {Object.entries(PARKING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField name="balcony_sqm" label="Erkély / terasz (m²)" value={d.balcony_sqm} step="0.1" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <YesNoSelect name="has_lift" label="Lift" value={d.has_lift} />
            <YesNoSelect name="has_air_conditioning" label="Klíma" value={d.has_air_conditioning} />
            <YesNoSelect name="has_garden_access" label="Kertkapcsolatos" value={d.has_garden_access} />
            <YesNoSelect name="is_furnished" label="Bútorozott" value={d.is_furnished} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <NumberField name="monthly_common_cost" label="Közös költség (Ft/hó)" value={d.monthly_common_cost} />
            {listingType === "rent" && (
              <>
                <NumberField name="min_lease_months" label="Min. bérleti idő (hó)" value={d.min_lease_months} />
                <YesNoSelect name="pets_allowed" label="Kisállat hozható" value={d.pets_allowed} />
              </>
            )}
          </div>
        </details>

        <label className={fieldGroupClass}>
          <span className={labelClass}>Egyéb jellemzők / jegyzet (opcionális)</span>
          <textarea
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className={fieldGroupClass}>
          <span className={labelClass}>Fotó hozzáadása (opcionális)</span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-background file:px-2.5 file:py-1 file:text-xs file:font-medium`}
          />
        </label>

        <div className={fieldGroupClass}>
          <div className="flex items-center justify-between">
            <span className={labelClass}>Hirdetési leírás (opcionális)</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !address.trim()}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-accent" />
              )}
              AI leírás generálása
            </Button>
          </div>
          <textarea
            name="ai_description"
            rows={5}
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            placeholder="Kattints az „AI leírás generálása” gombra, vagy írd meg kézzel."
            className={inputClass}
          />
          {aiError && <span className="text-xs text-danger">{aiError}</span>}
        </div>

        <Button type="submit" className="mt-1" disabled={isSaving}>
          {submitLabel}
        </Button>
      </form>
    </Card>
  );
}

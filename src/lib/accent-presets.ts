// Curated iroda-branding accent-szín készlet. Direkt NEM szabad hex-bevitel —
// előre definiált, kontraszt-ellenőrzött pár (accent/hover/soft), hogy a
// publikus ingatlan-oldal és a settings-előnézet garantáltan olvasható
// maradjon, bármelyik irodai felhasználó válassza is.
export type AccentPreset = {
  id: string;
  label: string;
  accent: string;
  hover: string;
  soft: string;
};

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "indigo", label: "Bluegate kék (alap)", accent: "#2e6ff2", hover: "#1f5bd8", soft: "#eaf1fe" },
  { id: "emerald", label: "Smaragd", accent: "#059669", hover: "#047857", soft: "#e6f6ef" },
  { id: "rose", label: "Rózsa", accent: "#e11d48", hover: "#be123c", soft: "#fde8ec" },
  { id: "amber", label: "Borostyán", accent: "#d97706", hover: "#b45309", soft: "#fdf1e0" },
  { id: "sky", label: "Ég", accent: "#0284c7", hover: "#0369a1", soft: "#e3f2fb" },
  { id: "violet", label: "Ibolya", accent: "#7c3aed", hover: "#6d28d9", soft: "#efe7fd" },
];

export const ACCENT_PRESET_IDS = ACCENT_PRESETS.map((p) => p.id);

export function getAccentPreset(id: string | null | undefined): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}

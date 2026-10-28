import { useColorScheme } from "react-native";

// A webes CRM színtokenjei (src/app/globals.css), hogy a két felület egy terméknek érződjön.
const light = {
  bg: "#f7f7f8",
  surface: "#ffffff",
  text: "#18181b",
  muted: "#71717a",
  subtle: "#a1a1aa",
  border: "#e4e4e7",
  accent: "#2e6ff2",
  accentSoft: "#eaf1fe",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  success: "#16a34a",
  successSoft: "#f0fdf4",
  warning: "#d97706",
  warningSoft: "#fffbeb",
};

const dark: typeof light = {
  bg: "#0b0b0f",
  surface: "#16161c",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  subtle: "#71717a",
  border: "#27272e",
  accent: "#4d86f5",
  accentSoft: "#16233a",
  danger: "#f87171",
  dangerSoft: "#3a1d1d",
  success: "#4ade80",
  successSoft: "#142a1c",
  warning: "#fbbf24",
  warningSoft: "#33270f",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

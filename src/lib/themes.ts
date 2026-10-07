import type { Settings } from "./finance";
export type VisualTheme = NonNullable<Settings["visualTheme"]>;
export const visualThemes = [
  {
    id: "light",
    name: "Light",
    description: "Clean whites & soft slate",
    background: "#f5f6f8",
    surface: "#ffffff",
    ink: "#263244",
    accent: "#dce5ef",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Charcoal & midnight",
    background: "#11151c",
    surface: "#1d2530",
    ink: "#0d131c",
    accent: "#a9c4e7",
  },
  {
    id: "green",
    name: "Green",
    description: "Deep forest & soft jade",
    background: "#0e1e19",
    surface: "#192f26",
    ink: "#091610",
    accent: "#93d7b6",
  },
  {
    id: "blue",
    name: "Blue",
    description: "Deep navy & ice blue",
    background: "#0e1b2e",
    surface: "#192c44",
    ink: "#0a1425",
    accent: "#9bc8f3",
  },
] as const;
export function isVisualTheme(value: unknown): value is VisualTheme {
  return visualThemes.some((theme) => theme.id === value);
}
export function resolveVisualTheme(
  settings: Settings,
  systemDark = false,
): VisualTheme {
  return (
    settings.visualTheme ??
    (settings.theme === "dark" || (settings.theme === "system" && systemDark)
      ? "dark"
      : "green")
  );
}
export function withVisualTheme(
  settings: Settings,
  visualTheme: VisualTheme,
): Settings {
  return {
    ...settings,
    visualTheme,
    theme: visualTheme === "light" ? "light" : "dark",
  };
}
export function applyVisualTheme(theme: VisualTheme) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.palette =
    theme === "green" ? "green" : theme === "blue" ? "blue" : "neutral";
  document.documentElement.style.colorScheme =
    theme === "light" ? "light" : "dark";
}
export const themeStorageKey = "saldo.visual-theme";
// Read a validated device preference before first paint. Account preferences
// remain authoritative once the signed-in workspace has loaded.
export const themeInitScript = `try{const t=localStorage.getItem('${themeStorageKey}');if(['light','dark','green','blue'].includes(t)){const r=document.documentElement;r.dataset.theme=t==='light'?'light':'dark';r.dataset.palette=t==='green'?'green':t==='blue'?'blue':'neutral';r.style.colorScheme=t==='light'?'light':'dark'}}catch{}`;

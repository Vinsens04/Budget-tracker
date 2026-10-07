import type { Settings } from "./finance";
export type VisualTheme = NonNullable<Settings["visualTheme"]>;
export const visualThemes = [
  {
    id: "light",
    name: "Light",
    description: "Porcelain & soft sage",
    background: "#f4f6f5",
    surface: "#ffffff",
    ink: "#273b32",
    accent: "#c6dfd1",
    sidebar: "#fafbfa",
    hero: "#294b3e",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Graphite & brushed silver",
    background: "#171b1e",
    surface: "#252b30",
    ink: "#111619",
    accent: "#cad4de",
    sidebar: "#111619",
    hero: "#303e48",
  },
  {
    id: "green",
    name: "Green",
    description: "Deep forest & soft jade",
    background: "#0e1e19",
    surface: "#192f26",
    ink: "#091610",
    accent: "#93d7b6",
    sidebar: "#091610",
    hero: "#204c39",
  },
  {
    id: "blue",
    name: "Blue",
    description: "Deep navy & ice blue",
    background: "#0e1b2e",
    surface: "#192c44",
    ink: "#0a1425",
    accent: "#9bc8f3",
    sidebar: "#0a1425",
    hero: "#254b76",
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

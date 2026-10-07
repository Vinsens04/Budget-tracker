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
    description: "Deep black & warm ivory",
    background: "#000000",
    surface: "#121212",
    ink: "#000000",
    accent: "#e8e1cf",
    sidebar: "#000000",
    hero: "#1a1a19",
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
    description: "Cobalt, indigo & lavender",
    background: "#0b1023",
    surface: "#161e36",
    ink: "#070b19",
    accent: "#a9baff",
    sidebar: "#070b19",
    hero: "#294cac",
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

export type Theme = "light" | "dark";
const STORAGE_KEY = "axecompta-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
}

// Exécuté en inline avant l'hydratation (voir app/layout.tsx) pour poser la
// classe `dark` dès le premier paint — sans ça, la page flashe en clair
// puis bascule en sombre une fois React monté.
export const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("${STORAGE_KEY}");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

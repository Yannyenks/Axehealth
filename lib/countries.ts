// Liste curatée (pas l'ISO-3166 complet) couvrant les marchés prioritaires —
// suffisant pour un premier lancement international sans maintenir une table
// de 249 pays. Les libellés sont dérivés via Intl.DisplayNames pour rester
// automatiquement traduits dans chaque langue supportée.
export const COUNTRY_CODES = [
  "CM", "SN", "CI", "TG", "BJ", "GA", "CD", "NE", "ML", "BF", "GN", "GA", "RW", "MA", "DZ", "TN", "NG", "GH", "KE", "CV",
  "FR", "BE", "CH", "LU", "DE", "ES", "PT", "GB", "IE",
  "CA", "US",
] as const;

export function countryOptions(locale: string): { code: string; label: string }[] {
  const displayNames = new Intl.DisplayNames([locale], { type: "region" });
  const unique = Array.from(new Set(COUNTRY_CODES));
  return unique
    .map((code) => ({ code, label: displayNames.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

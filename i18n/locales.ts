// Constantes partagées entre le serveur (i18n/request.ts, next/headers) et
// le client (components/locale-switcher.tsx) — isolées dans un fichier sans
// import serveur pour que le bundle client ne tire jamais next/headers.
export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE = "NEXT_LOCALE";

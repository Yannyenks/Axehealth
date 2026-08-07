import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type AppLocale } from "./locales";

// Pas de routing i18n par préfixe (`/en/...`) — l'app existante a des
// dizaines de routes déjà en place ; la locale des surfaces publiques
// (landing, /login, /signup, /onboarding) est résolue via un simple cookie.
// Les modules du dashboard restent en français pour cette phase (voir README).
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = SUPPORTED_LOCALES.includes(cookieLocale as AppLocale) ? (cookieLocale as AppLocale) : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

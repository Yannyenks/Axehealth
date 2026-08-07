"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locales";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  function setLocale(next: AppLocale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border p-0.5 text-xs font-medium", className)}>
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={cn(
            "rounded px-2 py-1 uppercase transition-colors",
            code === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

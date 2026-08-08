import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { OfflineProvider } from "./offline-provider";
import { Providers } from "./providers";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AxeHealth — ERP Santé",
  description: "SaaS de gestion intégrée pour cliniques et centres de santé en Afrique",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <OfflineProvider />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

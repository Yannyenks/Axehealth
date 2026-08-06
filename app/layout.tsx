import type { Metadata } from "next";
import "./globals.css";
import { OfflineProvider } from "./offline-provider";
import { Providers } from "./providers";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "AxeHealth — ERP Santé",
  description: "SaaS de gestion intégrée pour cliniques et centres de santé en Afrique",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          <OfflineProvider />
          {children}
        </Providers>
      </body>
    </html>
  );
}

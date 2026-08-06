import type { Metadata } from "next";
import "./globals.css";
import { OfflineProvider } from "./offline-provider";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AxeHealth — ERP Santé",
  description: "SaaS de gestion intégrée pour cliniques et centres de santé en Afrique",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <OfflineProvider />
          {children}
        </Providers>
      </body>
    </html>
  );
}

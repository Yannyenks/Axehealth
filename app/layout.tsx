import type { Metadata } from "next";
import "./globals.css";
import { OfflineProvider } from "./offline-provider";

export const metadata: Metadata = {
  title: "AxeHealth — ERP Santé",
  description: "SaaS de gestion intégrée pour cliniques et centres de santé en Afrique",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <OfflineProvider />
        {children}
      </body>
    </html>
  );
}

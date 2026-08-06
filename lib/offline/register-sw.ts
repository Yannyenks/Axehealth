import { flushQueue } from "./sync-queue";

const SYNC_TAG = "axehealth-sync-mutations";

// À appeler une seule fois côté client (voir app/offline-provider.tsx).
// Enregistre le service worker et branche deux déclencheurs de rejeu de la
// file de mutations: Background Sync API quand disponible, et l'événement
// `online` en repli pour les navigateurs qui ne l'implémentent pas
// (notamment Safari/iOS) — sans ce repli, la file resterait bloquée sur
// ces navigateurs jusqu'à un rechargement manuel.
export async function registerOfflineSupport(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.register("/sw.js");

  if ("sync" in registration) {
    try {
      // @ts-expect-error - SyncManager n'est pas encore dans lib.dom.d.ts standard
      await registration.sync.register(SYNC_TAG);
    } catch {
      // Background Sync indisponible/refusé — le repli `online` ci-dessous prend le relais.
    }
  }

  window.addEventListener("online", () => {
    void flushQueue();
  });
}

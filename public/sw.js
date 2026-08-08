// Service worker AxeCompta — Background Sync pour la file de mutations
// hors-ligne. Écrit en JS natif (pas de bundler ici) et opère directement
// sur la même base IndexedDB que lib/offline/db.ts (nom/version alignés).
//
// Portée volontairement limitée à cette itération: pas de cache d'assets
// (App Shell) via Workbox/next-pwa — à ajouter séparément si un usage
// hors-ligne "lecture" complet (pas seulement écriture en file) est requis.

const DB_NAME = "axecompta-offline";
const DB_VERSION = 1;
const MUTATION_STORE = "mutation-queue";
const SYNC_TAG = "axecompta-sync-mutations";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        db.createObjectStore(MUTATION_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATION_STORE, "readonly");
    const store = tx.objectStore(MUTATION_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATION_STORE, "readwrite");
    tx.objectStore(MUTATION_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushMutationQueue() {
  const db = await openDb();
  const mutations = await getAllMutations(db);
  mutations.sort((a, b) => a.id - b.id);

  for (const mutation of mutations) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.body),
      });
      if (!response.ok) break; // conserve l'ordre FIFO, on retentera au prochain sync
      await deleteMutation(db, mutation.id);
    } catch {
      break; // toujours hors-ligne
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushMutationQueue());
  }
});

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "axecompta-offline";
const DB_VERSION = 1;
export const MUTATION_STORE = "mutation-queue";
export const CACHE_STORE = "read-cache";

export interface QueuedMutation {
  id?: number;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body: unknown;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

// N'importer/appeler ce module que côté client (IndexedDB n'existe pas côté
// serveur Next.js) — toujours derrière `typeof window !== "undefined"`.
export function getOfflineDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(MUTATION_STORE)) {
          db.createObjectStore(MUTATION_STORE, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheRead(key: string, value: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.put(CACHE_STORE, { key, value, cachedAt: Date.now() });
}

export async function getCachedRead<T>(key: string): Promise<T | undefined> {
  const db = await getOfflineDb();
  const entry = await db.get(CACHE_STORE, key);
  return entry?.value as T | undefined;
}

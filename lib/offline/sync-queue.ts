import { getOfflineDb, MUTATION_STORE, type QueuedMutation } from "./db";

export async function enqueueMutation(url: string, method: QueuedMutation["method"], body: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.add(MUTATION_STORE, { url, method, body, createdAt: Date.now() });
}

// Rejoue la file dans l'ordre d'écriture (FIFO) — s'arrête à la première
// erreur pour ne jamais appliquer une mutation postérieure avant une
// antérieure (ex: décrémenter un stock avant de l'avoir réceptionné).
export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const db = await getOfflineDb();
  const all: QueuedMutation[] = await db.getAll(MUTATION_STORE);
  all.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  let flushed = 0;

  for (const mutation of all) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.body),
      });
      if (!response.ok) break;

      await db.delete(MUTATION_STORE, mutation.id!);
      flushed += 1;
    } catch {
      break; // toujours hors ligne (ou serveur inatteignable) — on retentera plus tard
    }
  }

  const remaining = (await db.count(MUTATION_STORE)) as number;
  return { flushed, remaining };
}

// Point d'entrée unique pour les mutations écrites dans les modules
// (consultations, caisse, pharmacie...) sous connectivité incertaine: tente
// l'appel réseau immédiatement, et ne bascule en file d'attente locale qu'en
// cas d'échec réseau avéré (pas sur une erreur métier 4xx/5xx du serveur,
// qui doit remonter normalement à l'appelant).
export async function mutateOfflineFirst(url: string, method: QueuedMutation["method"], body: unknown): Promise<Response | { queued: true }> {
  try {
    return await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    await enqueueMutation(url, method, body);
    return { queued: true };
  }
}

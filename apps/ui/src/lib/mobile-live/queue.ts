import type { ConsoleEvent } from "./types"

type Queued = ConsoleEvent & { key: string; sessionId: string }
const DATABASE = "libraries-global-live"

export async function liveQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DATABASE, 1)
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("checkins"))
        r.result.createObjectStore("checkins", { keyPath: "key" })
    }
    r.onsuccess = () => resolve(r.result)
    r.addEventListener("error", () => reject(r.error))
  })
}
async function operation<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await liveQueue()

  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkins", mode)
    const request = fn(tx.objectStore("checkins"))
    let value: T
    request.onsuccess = () => {
      value = request.result
    }
    request.addEventListener("error", () => reject(request.error))
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.addEventListener("error", () => {
      db.close()
      reject(tx.error)
    })
  })
}

export const enqueueCheckin = (sessionId: string, event: ConsoleEvent) =>
  operation("readwrite", (s) =>
    s.put({ ...event, key: `${sessionId}:${event.id}`, sessionId })
  )
export async function queuedCheckins(
  sessionId: string
): Promise<ConsoleEvent[]> {
  const rows = await operation<Queued[]>("readonly", (s) => s.getAll())

  return rows
    .filter((e) => e.sessionId === sessionId)
    .sort((a, b) => a.clientAt.localeCompare(b.clientAt))
    .map(({ key: _key, sessionId: _session, ...event }) => event)
}
export async function removeCheckins(sessionId: string, ids: string[]) {
  for (const id of ids)
    await operation("readwrite", (s) => s.delete(`${sessionId}:${id}`))
}
export async function clearSessionQueue(sessionId: string) {
  await removeCheckins(
    sessionId,
    (await queuedCheckins(sessionId)).map((e) => e.id)
  )
}

export async function clearLiveQueue() {
  await operation("readwrite", (store) => store.clear())
}
export async function pruneOldQueues(currentSessionId?: string) {
  const rows = await operation<Queued[]>("readonly", (store) => store.getAll())
  for (const row of rows)
    if (
      row.sessionId !== currentSessionId &&
      Date.now() - Date.parse(row.clientAt) > 10 * 60_000
    )
      await operation("readwrite", (store) => store.delete(row.key))
}

import type { ChatMessage } from '@/lib/chat'

// Offline-Fähigkeit des Chats (PWA): Nachrichten jeder Art – Text wie
// Medien-Blobs – landen bei Netzausfall in einer IndexedDB-Outbox und
// werden beim nächsten Online-Gehen gesendet; der letzte Verlauf wird
// gecacht, damit er offline lesbar bleibt. Alle Funktionen sind
// fail-soft: ohne IndexedDB (alte Browser, Tests) wird der Chat einfach
// nur nicht offline-fähig.

export interface OutboxEntry {
  id?: number
  kind: 'text' | 'media'
  text?: string
  blob?: Blob
  filename?: string
  queued_at: number
}

const DB_NAME = 'fd-chat'
const OUTBOX = 'outbox'
const KV = 'kv'

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

function done<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

export async function outboxAdd(entry: OutboxEntry): Promise<void> {
  const db = await openDb()
  if (!db) return
  await done(db.transaction(OUTBOX, 'readwrite').objectStore(OUTBOX).add(entry))
}

export async function outboxAll(): Promise<OutboxEntry[]> {
  const db = await openDb()
  if (!db) return []
  return (await done(db.transaction(OUTBOX).objectStore(OUTBOX).getAll())) ?? []
}

export async function outboxRemove(id: number): Promise<void> {
  const db = await openDb()
  if (!db) return
  await done(db.transaction(OUTBOX, 'readwrite').objectStore(OUTBOX).delete(id))
}

/** Letzten Verlauf für die Offline-Ansicht ablegen. */
export async function cacheMessages(msgs: ChatMessage[]): Promise<void> {
  const db = await openDb()
  if (!db) return
  await done(db.transaction(KV, 'readwrite').objectStore(KV).put(msgs, 'messages'))
}

export async function cachedMessages(): Promise<ChatMessage[]> {
  const db = await openDb()
  if (!db) return []
  return ((await done(db.transaction(KV).objectStore(KV).get('messages'))) ?? []) as ChatMessage[]
}

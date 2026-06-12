// REST-/WebSocket-Anbindung des Chat-Backends (axum, Same-Origin unter
// /chat/...). Im Dev-Modus leitet Astros Vite-Proxy die Aufrufe auf das
// lokal laufende Backend um (astro.config.mjs).

export type ChatRole = 'customer' | 'operator'

export type AttachmentKind = 'image' | 'voice' | 'video' | 'file'

export interface ChatAttachment {
  id: number
  kind: AttachmentKind
  mime: string
  size: number
  filename: string | null
  transcript: string | null
  transcript_status: 'pending' | 'done' | 'failed' | null
}

export interface ChatMessage {
  id: number
  conversation_id: number
  sender: ChatRole
  kind: 'text' | AttachmentKind
  body_text: string | null
  created_at: number
  attachment: ChatAttachment | null
}

/** Transkript einer Sprachnachricht wird asynchron nachgereicht. */
export interface TranscriptEvent {
  conversation_id: number
  message_id: number
  attachment_id: number
  transcript: string | null
  transcript_status: 'done' | 'failed'
}

export interface ChatConversation {
  id: number
  email: string
  created_at: number
  last_message_at: number | null
  unread: number
  last_text: string | null
}

export interface Me {
  role: ChatRole
  email: string
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** null = nicht angemeldet. */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch('/chat/api/me')
  if (res.status === 401) return null
  return asJson<Me>(res)
}

export function requestMagicLink(email: string, lang: string): Promise<Response> {
  return fetch('/chat/api/auth/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lang }),
  })
}

export async function logout(): Promise<void> {
  await fetch('/chat/api/auth/logout', { method: 'POST' })
}

// Pagination fürs endlose Scrollen: ohne `before` die neuesten Nachrichten,
// mit `before` (kleinste bekannte Id) die nächstälteren. Antwort immer
// aufsteigend.
export const PAGE_SIZE = 30

function pageQuery(before?: number, limit = PAGE_SIZE): string {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before != null) params.set('before', String(before))
  return params.toString()
}

export async function fetchMessages(before?: number): Promise<ChatMessage[]> {
  return asJson(await fetch(`/chat/api/messages?${pageQuery(before)}`))
}

export async function sendMessage(text: string): Promise<ChatMessage> {
  return asJson(
    await fetch('/chat/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  )
}

function mediaForm(file: Blob, filename: string): FormData {
  const form = new FormData()
  form.append('file', file, filename)
  return form
}

export async function sendMedia(file: Blob, filename: string): Promise<ChatMessage> {
  return asJson(
    await fetch('/chat/api/messages/media', { method: 'POST', body: mediaForm(file, filename) }),
  )
}

export function attachmentUrl(id: number): string {
  return `/chat/api/attachments/${id}`
}

/** Dateigröße kompakt formatieren (z. B. „2,4 MB"). */
export function formatSize(bytes: number, lang: string): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const n = unit === 0 ? value : value.toFixed(1)
  return `${String(n).replace('.', lang === 'en' ? '.' : ',')} ${units[unit]}`
}

export async function fetchConversations(): Promise<ChatConversation[]> {
  return asJson(await fetch('/chat/api/admin/conversations'))
}

export async function fetchConversationMessages(
  id: number,
  before?: number,
): Promise<ChatMessage[]> {
  return asJson(await fetch(`/chat/api/admin/conversations/${id}/messages?${pageQuery(before)}`))
}

export async function sendOperatorMessage(id: number, text: string): Promise<ChatMessage> {
  return asJson(
    await fetch(`/chat/api/admin/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  )
}

export async function sendOperatorMedia(
  id: number,
  file: Blob,
  filename: string,
): Promise<ChatMessage> {
  return asJson(
    await fetch(`/chat/api/admin/conversations/${id}/media`, {
      method: 'POST',
      body: mediaForm(file, filename),
    }),
  )
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`/chat/api/admin/conversations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

/** Eine Signalisierungsnachricht eines Anrufs (von der Gegenstelle). */
export interface SignalMessage {
  conversation_id: number
  from: ChatRole
  kind: string
  [key: string]: unknown
}

export interface SocketHandlers {
  onMessage: (msg: ChatMessage) => void
  onTranscript?: (ev: TranscriptEvent) => void
  /** WebRTC-Signalisierung der Anruf-Funktion. */
  onSignal?: (msg: SignalMessage) => void
}

/** Push-Kanal: Der Server schickt neue Nachrichten, Transkripte und die
 *  Anruf-Signalisierung; Chat-Nachrichten werden per REST gesendet. */
export function openChatSocket(handlers: SocketHandlers): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/chat/ws`)
  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data as string)
      if (data.type === 'message') handlers.onMessage(data.message as ChatMessage)
      else if (data.type === 'transcript') handlers.onTranscript?.(data as TranscriptEvent)
      else if (data.type === 'signal') handlers.onSignal?.(data as SignalMessage)
    } catch {
      // Kaputte Frames ignorieren – der Verlauf kommt notfalls per REST.
    }
  })
  return ws
}

/** Signalisierung an die Gegenstelle senden (Operator gibt die
 *  Konversation an; beim Kunden erzwingt der Server die eigene). */
export function sendSignal(
  ws: WebSocket | null,
  conversationId: number | null,
  payload: Record<string, unknown>,
): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'signal', conversation_id: conversationId, ...payload }))
}

/** Transkript-Event in eine Nachrichtenliste einarbeiten. */
export function applyTranscript(msgs: ChatMessage[], ev: TranscriptEvent): ChatMessage[] {
  return msgs.map((m) =>
    m.id === ev.message_id && m.attachment
      ? {
          ...m,
          attachment: {
            ...m.attachment,
            transcript: ev.transcript,
            transcript_status: ev.transcript_status,
          },
        }
      : m,
  )
}

/** Unix-Sekunden als kurze, lokale Zeitangabe. */
export function formatTime(unixSeconds: number, lang: string): string {
  return new Date(unixSeconds * 1000).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// REST-/WebSocket-Anbindung des Chat-Backends (axum, Same-Origin unter
// /chat/...). Im Dev-Modus leitet Astros Vite-Proxy die Aufrufe auf das
// lokal laufende Backend um (astro.config.mjs).

export type ChatRole = 'customer' | 'operator'

export interface ChatAttachment {
  id: number
  kind: 'image' | 'voice'
  mime: string
  size: number
  transcript: string | null
  transcript_status: 'pending' | 'done' | 'failed' | null
}

export interface ChatMessage {
  id: number
  conversation_id: number
  sender: ChatRole
  kind: 'text' | 'image' | 'voice'
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

export async function fetchMessages(): Promise<ChatMessage[]> {
  return asJson(await fetch('/chat/api/messages'))
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

export async function fetchConversations(): Promise<ChatConversation[]> {
  return asJson(await fetch('/chat/api/admin/conversations'))
}

export async function fetchConversationMessages(id: number): Promise<ChatMessage[]> {
  return asJson(await fetch(`/chat/api/admin/conversations/${id}/messages`))
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

export interface SocketHandlers {
  onMessage: (msg: ChatMessage) => void
  onTranscript?: (ev: TranscriptEvent) => void
}

/** Push-Kanal: Der Server schickt neue Nachrichten und Transkripte,
 *  gesendet wird per REST. */
export function openChatSocket(handlers: SocketHandlers): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/chat/ws`)
  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data as string)
      if (data.type === 'message') handlers.onMessage(data.message as ChatMessage)
      if (data.type === 'transcript') handlers.onTranscript?.(data as TranscriptEvent)
    } catch {
      // Kaputte Frames ignorieren – der Verlauf kommt notfalls per REST.
    }
  })
  return ws
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

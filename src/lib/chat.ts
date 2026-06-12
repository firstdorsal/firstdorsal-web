// REST-/WebSocket-Anbindung des Chat-Backends (axum, Same-Origin unter
// /chat/...). Im Dev-Modus leitet Astros Vite-Proxy die Aufrufe auf das
// lokal laufende Backend um (astro.config.mjs).

export type ChatRole = 'customer' | 'operator'

export interface ChatMessage {
  id: number
  conversation_id: number
  sender: ChatRole
  kind: 'text' | 'image' | 'voice'
  body_text: string | null
  created_at: number
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

export async function deleteConversation(id: number): Promise<void> {
  const res = await fetch(`/chat/api/admin/conversations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

/** Push-Kanal: Der Server schickt neue Nachrichten, gesendet wird per REST. */
export function openChatSocket(onMessage: (msg: ChatMessage) => void): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/chat/ws`)
  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data as string)
      if (data.type === 'message') onMessage(data.message as ChatMessage)
    } catch {
      // Kaputte Frames ignorieren – der Verlauf kommt notfalls per REST.
    }
  })
  return ws
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, Trash2, Video } from 'lucide-react'

import { Button } from '../ui/button'
import { Composer } from './Composer'
import { MessageBubble } from './MessageBubble'
import { MessageList } from './MessageList'
import { CallPanel, type CallHandle } from './CallPanel'
import {
  applyTranscript,
  deleteConversation,
  fetchConversationMessages,
  fetchConversations,
  fetchMe,
  formatTime,
  logout,
  openChatSocket,
  PAGE_SIZE,
  requestMagicLink,
  sendOperatorMedia,
  sendOperatorMessage,
  sendSignal,
  type ChatConversation,
  type ChatMessage,
} from '../lib/chat'

// Admin-Panel für den Operator (deutschsprachig, nur für den internen
// Gebrauch): links alle Konversationen, rechts der Verlauf mit
// Antwort-Eingabe. Zugang über denselben Magic-Link-Login wie das
// Kunden-Widget – nur Adressen aus OPERATOR_EMAILS bekommen die
// Operator-Rolle.

type Phase = 'laden' | 'anonym' | 'verschickt' | 'kunde' | 'admin'

export function AdminChat() {
  const [phase, setPhase] = useState<Phase>('laden')
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState('')
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const selectedRef = useRef<number | null>(null)
  selectedRef.current = selected
  const wsRef = useRef<WebSocket | null>(null)
  const callRef = useRef<CallHandle>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  // Signalisierung an die gerade geöffnete Konversation.
  const signal = useCallback(
    (payload: Record<string, unknown>) => sendSignal(wsRef.current, selectedRef.current, payload),
    [],
  )

  const refreshConversations = useCallback(() => {
    fetchConversations().then(setConversations).catch(() => {})
  }, [])

  useEffect(() => {
    fetchMe()
      .then((me) => {
        if (!me) setPhase('anonym')
        else setPhase(me.role === 'operator' ? 'admin' : 'kunde')
      })
      .catch(() => setPhase('anonym'))
  }, [])

  // Konversationsliste laden + WebSocket: jede neue Nachricht aktualisiert
  // die Liste, Nachrichten der offenen Konversation erscheinen direkt.
  useEffect(() => {
    if (phase !== 'admin') return
    let aktiv = true
    let timer: number | null = null
    refreshConversations()

    const verbinden = () => {
      if (!aktiv) return
      const ws = openChatSocket({
        onMessage: (msg) => {
          refreshConversations()
          if (msg.conversation_id === selectedRef.current) {
            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          }
        },
        onTranscript: (ev) => {
          if (ev.conversation_id === selectedRef.current) {
            setMessages((prev) => applyTranscript(prev, ev))
          }
        },
        // Signal nur annehmen, wenn es zur offenen Konversation gehört.
        onSignal: (msg) => {
          if (msg.conversation_id === selectedRef.current) callRef.current?.onSignal(msg)
        },
      })
      wsRef.current = ws
      ws.addEventListener('close', () => {
        if (aktiv) timer = window.setTimeout(verbinden, 3000)
      })
    }
    verbinden()
    return () => {
      aktiv = false
      if (timer) clearTimeout(timer)
      wsRef.current = null
    }
  }, [phase, refreshConversations])

  useEffect(() => {
    if (phase !== 'admin' || selected === null) return
    setHasMore(false)
    fetchConversationMessages(selected)
      .then((msgs) => {
        setMessages(msgs)
        setHasMore(msgs.length === PAGE_SIZE)
        refreshConversations() // ungelesen-Zähler ist jetzt 0
      })
      .catch(() => {})
  }, [phase, selected, refreshConversations])

  // Ältere Nachrichten der offenen Konversation nachladen (Virtual Scroll).
  const loadOlder = useCallback(() => {
    const conv = selectedRef.current
    const oldest = messagesRef.current[0]?.id
    if (conv == null || oldest == null) return
    fetchConversationMessages(conv, oldest)
      .then((aeltere) => {
        if (aeltere.length === 0) {
          setHasMore(false)
          return
        }
        setMessages((prev) => {
          const bekannt = new Set(prev.map((m) => m.id))
          return [...aeltere.filter((m) => !bekannt.has(m.id)), ...prev]
        })
        setHasMore(aeltere.length === PAGE_SIZE)
      })
      .catch(() => {})
  }, [])

  async function linkAnfordern(e: React.FormEvent) {
    e.preventDefault()
    setFehler('')
    const res = await requestMagicLink(email.trim(), 'de').catch(() => null)
    if (res?.ok) setPhase('verschickt')
    else setFehler('Link konnte nicht verschickt werden.')
  }

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
  }, [])

  async function antworten(text: string) {
    if (selected === null) return
    setFehler('')
    try {
      addMessage(await sendOperatorMessage(selected, text))
      refreshConversations()
    } catch {
      setFehler('Senden fehlgeschlagen.')
    }
  }

  async function medienAntworten(blob: Blob, filename: string) {
    if (selected === null) return
    setFehler('')
    try {
      addMessage(await sendOperatorMedia(selected, blob, filename))
      refreshConversations()
    } catch {
      setFehler('Senden fehlgeschlagen.')
    }
  }

  async function loeschen(id: number) {
    if (!confirm('Konversation samt Verlauf endgültig löschen?')) return
    await deleteConversation(id).catch(() => {})
    if (selected === id) {
      setSelected(null)
      setMessages([])
    }
    refreshConversations()
  }

  if (phase === 'laden') {
    return <p className="p-8 font-mono text-sm text-muted-foreground">Lade …</p>
  }

  if (phase === 'kunde') {
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="text-sm/relaxed">
          Sie sind als Kunde angemeldet – die Verwaltung ist dem Operator vorbehalten. Zum
          Chat geht es auf der <a href="/" className="text-brand underline">Startseite</a>.
        </p>
      </div>
    )
  }

  if (phase === 'anonym' || phase === 'verschickt') {
    return (
      <div className="mx-auto max-w-md p-8">
        <p className="annotation text-lg">Chat-Verwaltung</p>
        {phase === 'verschickt' ? (
          <p className="mt-4 text-sm/relaxed">
            Anmeldelink verschickt – bitte Posteingang prüfen.
          </p>
        ) : (
          <form onSubmit={linkAnfordern} className="mt-4 flex flex-col gap-3">
            <label className="label-caps text-xs" htmlFor="admin-email">
              Operator-E-Mail
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <Button type="submit">Anmeldelink senden</Button>
            {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          </form>
        )}
      </div>
    )
  }

  const aktive = conversations.find((c) => c.id === selected)

  return (
    <div className="mx-auto flex h-svh max-w-6xl flex-col px-4 py-6">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <p className="annotation text-lg">Chat-Verwaltung</p>
        <Button variant="ghost" size="sm" onClick={() => logout().then(() => setPhase('anonym'))}>
          Abmelden
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
          {conversations.length === 0 && (
            <p className="p-4 font-mono text-xs text-muted-foreground">
              Noch keine Konversationen.
            </p>
          )}
          <ul>
            {conversations.map((c) => (
              <li key={c.id} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent ${
                    selected === c.id ? 'bg-accent' : ''
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.email}</span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[10px] text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </span>
                  {c.last_text && (
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {c.last_text}
                    </span>
                  )}
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    {formatTime(c.last_message_at ?? c.created_at, 'de')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col">
          {aktive ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <p className="truncate text-sm font-medium">{aktive.email}</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Sprachanruf starten"
                    onClick={() => callRef.current?.startCall(false)}
                  >
                    <Phone aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Videoanruf starten"
                    onClick={() => callRef.current?.startCall(true)}
                  >
                    <Video aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Konversation löschen"
                    onClick={() => loeschen(aktive.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <MessageList
                messages={messages}
                hasMore={hasMore}
                onLoadOlder={loadOlder}
                renderMessage={(m) => (
                  <MessageBubble
                    message={m}
                    self={m.sender === 'operator'}
                    senderLabel={m.sender === 'operator' ? 'Sie' : aktive.email}
                    lang="de"
                  />
                )}
              />
              {fehler && <p className="px-4 pb-1 text-xs text-destructive">{fehler}</p>}
              <Composer lang="de" onText={antworten} onMedia={medienAntworten} />
              {/* Anruf-Overlay über dem geöffneten Gespräch. */}
              <CallPanel ref={callRef} lang="de" polite={false} signal={signal} />
            </>
          ) : (
            <p className="annotation m-auto text-sm text-muted-foreground">
              Konversation auswählen.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

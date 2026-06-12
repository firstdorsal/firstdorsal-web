import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  deleteConversation,
  fetchConversationMessages,
  fetchConversations,
  fetchMe,
  formatTime,
  logout,
  openChatSocket,
  requestMagicLink,
  sendOperatorMessage,
  type ChatConversation,
  type ChatMessage,
} from '@/lib/chat'

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
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<number | null>(null)
  selectedRef.current = selected

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
      const ws = openChatSocket((msg) => {
        refreshConversations()
        if (msg.conversation_id === selectedRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        }
      })
      ws.addEventListener('close', () => {
        if (aktiv) timer = window.setTimeout(verbinden, 3000)
      })
    }
    verbinden()
    return () => {
      aktiv = false
      if (timer) clearTimeout(timer)
    }
  }, [phase, refreshConversations])

  useEffect(() => {
    if (phase !== 'admin' || selected === null) return
    fetchConversationMessages(selected)
      .then((msgs) => {
        setMessages(msgs)
        refreshConversations() // ungelesen-Zähler ist jetzt 0
      })
      .catch(() => {})
  }, [phase, selected, refreshConversations])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function linkAnfordern(e: React.FormEvent) {
    e.preventDefault()
    setFehler('')
    const res = await requestMagicLink(email.trim(), 'de').catch(() => null)
    if (res?.ok) setPhase('verschickt')
    else setFehler('Link konnte nicht verschickt werden.')
  }

  async function antworten(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || selected === null) return
    try {
      const msg = await sendOperatorMessage(selected, text)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      setDraft('')
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

        <section className="flex min-w-0 flex-1 flex-col">
          {aktive ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <p className="truncate text-sm font-medium">{aktive.email}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Konversation löschen"
                  onClick={() => loeschen(aktive.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-md border border-border px-3 py-2 ${
                      m.sender === 'operator' ? 'ml-auto bg-accent' : 'bg-secondary'
                    }`}
                  >
                    <p className="text-sm/relaxed break-words whitespace-pre-wrap">
                      {m.body_text}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {m.sender === 'operator' ? 'Sie' : aktive.email} ·{' '}
                      {formatTime(m.created_at, 'de')}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={antworten} className="border-t border-border p-3">
                {fehler && <p className="mb-2 text-xs text-destructive">{fehler}</p>}
                <div className="flex gap-2">
                  <input
                    aria-label="Antwort schreiben"
                    placeholder="Antwort schreiben …"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <Button type="submit" size="icon" aria-label="Antwort senden">
                    <Send aria-hidden="true" />
                  </Button>
                </div>
              </form>
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

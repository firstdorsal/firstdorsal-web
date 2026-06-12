import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  fetchMe,
  fetchMessages,
  formatTime,
  logout,
  openChatSocket,
  requestMagicLink,
  sendMessage,
  type ChatMessage,
} from '@/lib/chat'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    launcher: 'Chat öffnen',
    schliessen: 'Chat schließen',
    titel: 'Direkter Draht',
    intro:
      'Schreiben Sie uns direkt – Sie chatten mit Paul persönlich, nicht mit einem Bot.',
    emailLabel: 'Ihre E-Mail-Adresse',
    linkSenden: 'Anmeldelink senden',
    datenschutzVor: 'Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben gemäß ',
    datenschutzLink: 'Datenschutzerklärung',
    datenschutzNach: ' zu.',
    verschickt:
      'Fast geschafft: Wir haben Ihnen einen Anmeldelink geschickt. Bitte prüfen Sie Ihren Posteingang (auch den Spam-Ordner).',
    leer: 'Noch keine Nachrichten – erzählen Sie uns, wo es weh tut.',
    placeholder: 'Nachricht schreiben …',
    senden: 'Nachricht senden',
    abmelden: 'Abmelden',
    operatorHinweis: 'Sie sind als Operator angemeldet – zur Verwaltung geht es hier:',
    adminLink: 'Chat-Verwaltung öffnen',
    fehlerEmail: 'Bitte eine gültige E-Mail-Adresse angeben.',
    fehlerRate: 'Zu viele Versuche – bitte warten Sie einen Moment.',
    fehlerMail: 'Der Link konnte nicht verschickt werden – bitte später erneut versuchen.',
    fehlerSenden: 'Senden fehlgeschlagen – bitte erneut versuchen.',
    ich: 'Sie',
    firma: 'firstdorsal',
  },
  en: {
    launcher: 'Open chat',
    schliessen: 'Close chat',
    titel: 'Direct line',
    intro: 'Message us directly – you chat with Paul in person, not with a bot.',
    emailLabel: 'Your email address',
    linkSenden: 'Send sign-in link',
    datenschutzVor: 'By submitting you consent to the processing of your data as described in our ',
    datenschutzLink: 'privacy policy',
    datenschutzNach: '.',
    verschickt:
      'Almost there: we sent you a sign-in link. Please check your inbox (and the spam folder).',
    leer: 'No messages yet – tell us where it hurts.',
    placeholder: 'Write a message …',
    senden: 'Send message',
    abmelden: 'Sign out',
    operatorHinweis: 'You are signed in as the operator – manage chats here:',
    adminLink: 'Open chat admin',
    fehlerEmail: 'Please enter a valid email address.',
    fehlerRate: 'Too many attempts – please wait a moment.',
    fehlerMail: 'The link could not be sent – please try again later.',
    fehlerSenden: 'Sending failed – please try again.',
    ich: 'You',
    firma: 'firstdorsal',
  },
}

type Phase = 'laden' | 'anonym' | 'verschickt' | 'chat' | 'operator'

// Kunden-Chat als schwebende Insel: E-Mail → Magic-Link → Chat. Nach dem
// Klick auf den Link landet man mit ?chat=open wieder hier, das Widget
// öffnet sich dann von selbst. Empfang neuer Nachrichten per WebSocket
// (mit Auto-Reconnect), gesendet wird per REST.
export function ChatWidget({ lang = 'de' }: { lang?: Lang }) {
  const t = texte[lang]
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('laden')
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
  }, [])

  // Nach dem Magic-Link-Redirect (?chat=open) direkt öffnen.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('chat') === 'open') setOpen(true)
  }, [])

  // Beim Öffnen den Anmeldestatus klären.
  useEffect(() => {
    if (!open || phase !== 'laden') return
    let aktiv = true
    fetchMe()
      .then((me) => {
        if (!aktiv) return
        if (!me) setPhase('anonym')
        else setPhase(me.role === 'operator' ? 'operator' : 'chat')
      })
      .catch(() => aktiv && setPhase('anonym'))
    return () => {
      aktiv = false
    }
  }, [open, phase])

  // Im Chat: Verlauf laden + WebSocket mit Auto-Reconnect halten.
  useEffect(() => {
    if (!open || phase !== 'chat') return
    let aktiv = true
    fetchMessages()
      .then((msgs) => aktiv && setMessages(msgs))
      .catch(() => {})

    const verbinden = () => {
      if (!aktiv) return
      const ws = openChatSocket(addMessage)
      wsRef.current = ws
      ws.addEventListener('close', () => {
        if (aktiv) reconnectRef.current = window.setTimeout(verbinden, 3000)
      })
    }
    verbinden()
    return () => {
      aktiv = false
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [open, phase, addMessage])

  // Neue Nachrichten ins Sichtfeld scrollen.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function linkAnfordern(e: React.FormEvent) {
    e.preventDefault()
    setFehler('')
    const res = await requestMagicLink(email.trim(), lang).catch(() => null)
    if (res?.ok) setPhase('verschickt')
    else if (res?.status === 422) setFehler(t.fehlerEmail)
    else if (res?.status === 429) setFehler(t.fehlerRate)
    else setFehler(t.fehlerMail)
  }

  async function nachrichtSenden(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setFehler('')
    try {
      addMessage(await sendMessage(text))
      setDraft('')
    } catch {
      setFehler(t.fehlerSenden)
    } finally {
      setSending(false)
    }
  }

  async function abmelden() {
    await logout()
    setMessages([])
    setPhase('anonym')
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t.launcher}
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-50 rounded-full border border-border bg-card p-3.5 text-brand shadow-lg transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={t.titel}
      className="fixed right-5 bottom-5 z-50 flex h-[min(34rem,calc(100svh-5rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="annotation text-base">{t.titel}</p>
        <div className="flex items-center gap-1">
          {phase === 'chat' && (
            <Button variant="ghost" size="sm" onClick={abmelden}>
              {t.abmelden}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.schliessen}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>

      {phase === 'laden' && (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-mono text-xs text-muted-foreground">…</p>
        </div>
      )}

      {phase === 'anonym' && (
        <form onSubmit={linkAnfordern} className="flex flex-1 flex-col gap-4 p-5">
          <p className="text-sm/relaxed text-muted-foreground">{t.intro}</p>
          <label className="label-caps text-xs" htmlFor="chat-email">
            {t.emailLabel}
          </label>
          <input
            id="chat-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button type="submit">{t.linkSenden}</Button>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <p className="annotation mt-auto text-xs text-muted-foreground">
            {t.datenschutzVor}
            <a href="/datenschutz" className="underline underline-offset-2">
              {t.datenschutzLink}
            </a>
            {t.datenschutzNach}
          </p>
        </form>
      )}

      {phase === 'verschickt' && (
        <div className="flex flex-1 flex-col justify-center gap-4 p-5 text-center">
          <p className="text-sm/relaxed">{t.verschickt}</p>
        </div>
      )}

      {phase === 'operator' && (
        <div className="flex flex-1 flex-col justify-center gap-4 p-5 text-center">
          <p className="text-sm/relaxed">{t.operatorHinweis}</p>
          <a href="/chat/admin/" className="text-sm font-medium text-brand underline underline-offset-2">
            {t.adminLink}
          </a>
        </div>
      )}

      {phase === 'chat' && (
        <>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="annotation py-6 text-center text-sm text-muted-foreground">
                {t.leer}
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-md border border-border px-3 py-2 ${
                  m.sender === 'customer' ? 'ml-auto bg-accent' : 'bg-secondary'
                }`}
              >
                <p className="text-sm/relaxed break-words whitespace-pre-wrap">{m.body_text}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {m.sender === 'customer' ? t.ich : t.firma} · {formatTime(m.created_at, lang)}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={nachrichtSenden} className="border-t border-border p-3">
            {fehler && <p className="mb-2 text-xs text-destructive">{fehler}</p>}
            <div className="flex gap-2">
              <input
                aria-label={t.placeholder}
                placeholder={t.placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <Button type="submit" size="icon" aria-label={t.senden} disabled={sending}>
                <Send aria-hidden="true" />
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}

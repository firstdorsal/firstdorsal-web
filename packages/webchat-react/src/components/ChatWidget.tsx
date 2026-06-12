import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Phone, Video, X } from 'lucide-react'

import { Button } from '../ui/button'
import { Composer } from './Composer'
import { MessageBubble, PendingBubble } from './MessageBubble'
import { MessageList } from './MessageList'
import { CallPanel, type CallHandle } from './CallPanel'
import {
  applyTranscript,
  fetchMe,
  fetchMessages,
  logout,
  openChatSocket,
  PAGE_SIZE,
  requestMagicLink,
  sendMedia,
  sendMessage,
  sendSignal,
  type ChatMessage,
} from '../lib/chat'
import {
  cacheMessages,
  cachedMessages,
  outboxAdd,
  outboxAll,
  outboxRemove,
  type OutboxEntry,
} from '../lib/offline'
import type { Lang } from '../i18n'

// Markenneutrale Texte: der Name des Ansprechpartners (`agentName`) und
// der Firmenname (`brandName`) werden als Props hereingereicht, damit das
// Widget ohne Quelltextänderung für beliebige Betreiber passt.
const texte = {
  de: {
    launcher: 'Chat öffnen',
    schliessen: 'Chat schließen',
    titel: 'Direkter Draht',
    intro: (agent: string) =>
      `Schreiben Sie uns direkt – Sie chatten mit ${agent} persönlich, nicht mit einem Bot.`,
    emailLabel: 'Ihre E-Mail-Adresse',
    linkSenden: 'Anmeldelink senden',
    datenschutzVor: 'Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben gemäß ',
    datenschutzLink: 'Datenschutzerklärung',
    datenschutzNach: ' zu.',
    verschickt:
      'Fast geschafft: Wir haben Ihnen einen Anmeldelink geschickt. Bitte prüfen Sie Ihren Posteingang (auch den Spam-Ordner).',
    leer: 'Noch keine Nachrichten – erzählen Sie uns, wo es weh tut.',
    abmelden: 'Abmelden',
    operatorHinweis: 'Sie sind als Operator angemeldet – zur Verwaltung geht es hier:',
    adminLink: 'Chat-Verwaltung öffnen',
    anrufAudio: 'Sprachanruf starten',
    anrufVideo: 'Videoanruf starten',
    offline: 'Offline – Nachrichten werden gesendet, sobald Sie wieder online sind.',
    fehlerEmail: 'Bitte eine gültige E-Mail-Adresse angeben.',
    fehlerRate: 'Zu viele Versuche – bitte warten Sie einen Moment.',
    fehlerMail: 'Der Link konnte nicht verschickt werden – bitte später erneut versuchen.',
    fehlerSenden: 'Senden fehlgeschlagen – bitte erneut versuchen.',
    ich: 'Sie',
  },
  en: {
    launcher: 'Open chat',
    schliessen: 'Close chat',
    titel: 'Direct line',
    intro: (agent: string) =>
      `Message us directly – you chat with ${agent} in person, not with a bot.`,
    emailLabel: 'Your email address',
    linkSenden: 'Send sign-in link',
    datenschutzVor: 'By submitting you consent to the processing of your data as described in our ',
    datenschutzLink: 'privacy policy',
    datenschutzNach: '.',
    verschickt:
      'Almost there: we sent you a sign-in link. Please check your inbox (and the spam folder).',
    leer: 'No messages yet – tell us where it hurts.',
    abmelden: 'Sign out',
    operatorHinweis: 'You are signed in as the operator – manage chats here:',
    adminLink: 'Open chat admin',
    anrufAudio: 'Start voice call',
    anrufVideo: 'Start video call',
    offline: 'Offline – messages will be sent as soon as you are back online.',
    fehlerEmail: 'Please enter a valid email address.',
    fehlerRate: 'Too many attempts – please wait a moment.',
    fehlerMail: 'The link could not be sent – please try again later.',
    fehlerSenden: 'Sending failed – please try again.',
    ich: 'You',
  },
}

export interface ChatWidgetProps {
  /** Sprache der Oberfläche (Standard 'de'). */
  lang?: Lang
  /** Anzeigename des Betreibers für fremde Nachrichten (Standard 'firstdorsal'). */
  brandName?: string
  /** Name des persönlichen Ansprechpartners im Intro-Text (Standard 'Paul'). */
  agentName?: string
  /** Ziel des Datenschutz-Links im Einwilligungshinweis (Standard '/datenschutz'). */
  privacyHref?: string
  /** Ziel des Links zur Operator-Verwaltung (Standard '/chat/admin/'). */
  adminHref?: string
}

type Phase = 'laden' | 'anonym' | 'verschickt' | 'chat' | 'operator'

// Kunden-Chat als schwebende Insel: E-Mail → Magic-Link → Chat. Nach dem
// Klick auf den Link landet man mit ?chat=open wieder hier, das Widget
// öffnet sich dann von selbst. Empfang neuer Nachrichten und Transkripte
// per WebSocket (Auto-Reconnect), gesendet wird per REST. Offline gehen
// Nachrichten jeder Art in die IndexedDB-Outbox (PWA) und werden beim
// nächsten Online-Gehen zugestellt.
export function ChatWidget({
  lang = 'de',
  brandName = 'firstdorsal',
  agentName = 'Paul',
  privacyHref = '/datenschutz',
  adminHref = '/chat/admin/',
}: ChatWidgetProps) {
  const t = texte[lang]
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('laden')
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [pending, setPending] = useState<OutboxEntry[]>([])
  const [istOffline, setIstOffline] = useState(false)
  const flushingRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const callRef = useRef<CallHandle>(null)
  // Aktuelle Nachrichten für Callbacks ohne Neuanlegen (loadOlder).
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  // Signalisierung über den jeweils aktuellen Socket; die eigene
  // Konversation erzwingt der Server (conversation_id darf null sein).
  const signal = useCallback(
    (payload: Record<string, unknown>) => sendSignal(wsRef.current, null, payload),
    [],
  )

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
  }, [])

  /** Outbox abarbeiten: der Reihe nach senden, bei Netzfehler abbrechen. */
  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return
    flushingRef.current = true
    try {
      for (const entry of await outboxAll()) {
        try {
          const msg =
            entry.kind === 'text'
              ? await sendMessage(entry.text ?? '')
              : await sendMedia(entry.blob as Blob, entry.filename ?? 'datei')
          addMessage(msg)
          if (entry.id != null) await outboxRemove(entry.id)
        } catch (e) {
          if (e instanceof TypeError) break // weiterhin offline
          if (entry.id != null) await outboxRemove(entry.id) // unsendbarer Eintrag
        }
      }
    } finally {
      flushingRef.current = false
      setPending(await outboxAll())
      setIstOffline(!navigator.onLine)
    }
  }, [addMessage])

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

  // Im Chat: Verlauf laden (offline: aus dem Cache), Outbox anstoßen und
  // WebSocket mit Auto-Reconnect halten.
  useEffect(() => {
    if (!open || phase !== 'chat') return
    let aktiv = true
    let timer: number | null = null
    let ws: WebSocket | null = null
    setIstOffline(!navigator.onLine)

    fetchMessages()
      .then((msgs) => {
        if (!aktiv) return
        setMessages(msgs)
        setHasMore(msgs.length === PAGE_SIZE)
        void flushOutbox()
      })
      .catch(async () => {
        if (aktiv) {
          setMessages(await cachedMessages())
          setHasMore(false)
        }
      })
    outboxAll().then((p) => aktiv && setPending(p))

    const onOnline = () => {
      setIstOffline(false)
      void flushOutbox()
    }
    const onOffline = () => setIstOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const verbinden = () => {
      if (!aktiv) return
      ws = openChatSocket({
        onMessage: addMessage,
        onTranscript: (ev) => setMessages((prev) => applyTranscript(prev, ev)),
        onSignal: (msg) => callRef.current?.onSignal(msg),
      })
      wsRef.current = ws
      ws.addEventListener('open', () => void flushOutbox())
      ws.addEventListener('close', () => {
        if (aktiv) timer = window.setTimeout(verbinden, 3000)
      })
    }
    verbinden()
    return () => {
      aktiv = false
      if (timer) clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      ws?.close()
      wsRef.current = null
    }
  }, [open, phase, addMessage, flushOutbox])

  // Verlauf für die Offline-Ansicht aktuell halten (nur das jüngste
  // Fenster – das genügt für die Offline-Lesbarkeit).
  useEffect(() => {
    if (phase === 'chat' && messages.length > 0) void cacheMessages(messages.slice(-PAGE_SIZE))
  }, [phase, messages])

  // Ältere Nachrichten nachladen (oben anstellen) für endloses Scrollen.
  const loadOlder = useCallback(() => {
    const oldest = messagesRef.current[0]?.id
    if (oldest == null) return
    fetchMessages(oldest)
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
    const res = await requestMagicLink(email.trim(), lang).catch(() => null)
    if (res?.ok) setPhase('verschickt')
    else if (res?.status === 422) setFehler(t.fehlerEmail)
    else if (res?.status === 429) setFehler(t.fehlerRate)
    else setFehler(t.fehlerMail)
  }

  /** Senden mit Offline-Fallback: Netzfehler → Outbox statt Fehlermeldung. */
  async function sendenOderEinreihen(entry: OutboxEntry, senden: () => Promise<ChatMessage>) {
    setFehler('')
    try {
      addMessage(await senden())
    } catch (e) {
      if (e instanceof TypeError) {
        await outboxAdd(entry)
        setPending(await outboxAll())
        setIstOffline(true)
      } else {
        setFehler(t.fehlerSenden)
      }
    }
  }

  const textSenden = (text: string) =>
    sendenOderEinreihen({ kind: 'text', text, queued_at: Date.now() }, () => sendMessage(text))

  const medienSenden = (blob: Blob, filename: string) =>
    sendenOderEinreihen({ kind: 'media', blob, filename, queued_at: Date.now() }, () =>
      sendMedia(blob, filename),
    )

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
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.anrufAudio}
                onClick={() => callRef.current?.startCall(false)}
              >
                <Phone aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.anrufVideo}
                onClick={() => callRef.current?.startCall(true)}
              >
                <Video aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={abmelden}>
                {t.abmelden}
              </Button>
            </>
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
          <p className="text-sm/relaxed text-muted-foreground">{t.intro(agentName)}</p>
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
            <a href={privacyHref} className="underline underline-offset-2">
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
          <a
            href={adminHref}
            className="text-sm font-medium text-brand underline underline-offset-2"
          >
            {t.adminLink}
          </a>
        </div>
      )}

      {phase === 'chat' && (
        <>
          {istOffline && (
            <p className="border-b border-border bg-secondary px-4 py-2 text-xs text-muted-foreground">
              {t.offline}
            </p>
          )}
          <MessageList
            messages={messages}
            hasMore={hasMore}
            onLoadOlder={loadOlder}
            renderMessage={(m) => (
              <MessageBubble
                message={m}
                self={m.sender === 'customer'}
                senderLabel={m.sender === 'customer' ? t.ich : brandName}
                lang={lang}
              />
            )}
            trailing={pending.map((p) => ({
              key: `pending-${p.id}`,
              node: <PendingBubble entry={p} lang={lang} />,
            }))}
            empty={
              <p className="annotation py-6 text-center text-sm text-muted-foreground">{t.leer}</p>
            }
          />
          {fehler && <p className="px-4 pb-1 text-xs text-destructive">{fehler}</p>}
          <Composer lang={lang} onText={textSenden} onMedia={medienSenden} />
        </>
      )}

      {/* Anruf-Overlay: liegt über dem Chat, sobald ein Anruf läuft. */}
      {phase === 'chat' && (
        <CallPanel ref={callRef} lang={lang} polite signal={signal} />
      )}
    </div>
  )
}

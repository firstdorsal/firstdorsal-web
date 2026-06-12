import { useEffect, useMemo } from 'react'

import { attachmentUrl, formatTime, type ChatMessage } from '@/lib/chat'
import type { OutboxEntry } from '@/lib/offline'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    transkriptLaeuft: 'Transkription läuft …',
    bildAlt: 'Gesendetes Bild',
    wartet: 'wartet auf Versand …',
  },
  en: {
    transkriptLaeuft: 'Transcribing …',
    bildAlt: 'Sent image',
    wartet: 'waiting to be sent …',
  },
}

// Eine Chat-Nachricht im Tafel-Stil: eigene rechts (bg-accent), fremde
// links (bg-secondary). Bilder und Sprachnachrichten kommen über die
// authentifizierte Attachment-Route; unter Sprachnachrichten erscheint
// das (nachgereichte) Whisper-Transkript als Anmerkung.
export function MessageBubble({
  message,
  self,
  senderLabel,
  lang,
}: {
  message: ChatMessage
  self: boolean
  senderLabel: string
  lang: Lang
}) {
  const t = texte[lang]
  const a = message.attachment

  return (
    <div
      className={`max-w-[85%] rounded-md border border-border px-3 py-2 ${
        self ? 'ml-auto bg-accent' : 'bg-secondary'
      }`}
    >
      {message.kind === 'text' && (
        <p className="text-sm/relaxed break-words whitespace-pre-wrap">{message.body_text}</p>
      )}
      {message.kind === 'image' && a && (
        <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer">
          <img
            src={attachmentUrl(a.id)}
            alt={t.bildAlt}
            loading="lazy"
            className="max-h-56 rounded-sm"
          />
        </a>
      )}
      {message.kind === 'voice' && a && (
        <>
          {/* preload=none: Audio erst beim Abspielen laden. */}
          <audio controls preload="none" src={attachmentUrl(a.id)} className="w-full max-w-64" />
          {a.transcript_status === 'pending' && (
            <p className="annotation mt-1 text-xs text-muted-foreground">{t.transkriptLaeuft}</p>
          )}
          {a.transcript_status === 'done' && a.transcript && (
            <p data-testid="transcript" className="annotation mt-1 text-xs">
              „{a.transcript}“
            </p>
          )}
        </>
      )}
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {senderLabel} · {formatTime(message.created_at, lang)}
      </p>
    </div>
  )
}

/** Noch nicht gesendete Offline-Nachricht (Outbox) – ausgegraut, mit
 *  Versand-Hinweis. Medien werden aus dem lokalen Blob voraus angezeigt. */
export function PendingBubble({ entry, lang }: { entry: OutboxEntry; lang: Lang }) {
  const t = texte[lang]
  const url = useMemo(
    () => (entry.blob ? URL.createObjectURL(entry.blob) : null),
    [entry.blob],
  )
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])
  const istBild = entry.blob?.type.startsWith('image/')

  return (
    <div className="ml-auto max-w-[85%] rounded-md border border-dashed border-border bg-accent/50 px-3 py-2 opacity-80">
      {entry.kind === 'text' && (
        <p className="text-sm/relaxed break-words whitespace-pre-wrap">{entry.text}</p>
      )}
      {entry.kind === 'media' && url && istBild && (
        <img src={url} alt={t.bildAlt} className="max-h-56 rounded-sm" />
      )}
      {entry.kind === 'media' && url && !istBild && (
        <audio controls preload="metadata" src={url} className="w-full max-w-64" />
      )}
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{t.wartet}</p>
    </div>
  )
}

import { useEffect, useMemo } from 'react'
import { Download, FileText } from 'lucide-react'

import { attachmentUrl, formatSize, formatTime, type ChatMessage } from '@/lib/chat'
import type { OutboxEntry } from '@/lib/offline'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    transkriptLaeuft: 'Transkription läuft …',
    bildAlt: 'Gesendetes Bild',
    wartet: 'wartet auf Versand …',
    datei: 'Datei',
    herunterladen: 'Herunterladen',
  },
  en: {
    transkriptLaeuft: 'Transcribing …',
    bildAlt: 'Sent image',
    wartet: 'waiting to be sent …',
    datei: 'File',
    herunterladen: 'Download',
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
      {message.kind === 'video' && a && (
        <video controls preload="metadata" src={attachmentUrl(a.id)} className="max-h-64 rounded-sm" />
      )}
      {message.kind === 'file' && a && (
        <a
          href={attachmentUrl(a.id)}
          download={a.filename ?? undefined}
          className="flex items-center gap-2 rounded-sm border border-border bg-background/50 px-2.5 py-2 hover:bg-background"
        >
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate text-sm">{a.filename ?? t.datei}</span>
            <span className="block font-mono text-[10px] text-muted-foreground">
              {formatSize(a.size, lang)}
            </span>
          </span>
          <Download className="size-4 shrink-0 text-muted-foreground" aria-label={t.herunterladen} />
        </a>
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
  const typ = entry.blob?.type ?? ''

  return (
    <div className="ml-auto max-w-[85%] rounded-md border border-dashed border-border bg-accent/50 px-3 py-2 opacity-80">
      {entry.kind === 'text' && (
        <p className="text-sm/relaxed break-words whitespace-pre-wrap">{entry.text}</p>
      )}
      {entry.kind === 'media' && url && typ.startsWith('image/') && (
        <img src={url} alt={t.bildAlt} className="max-h-56 rounded-sm" />
      )}
      {entry.kind === 'media' && url && typ.startsWith('audio/') && (
        <audio controls preload="metadata" src={url} className="w-full max-w-64" />
      )}
      {entry.kind === 'media' && url && typ.startsWith('video/') && (
        <video controls preload="metadata" src={url} className="max-h-64 rounded-sm" />
      )}
      {entry.kind === 'media' &&
        !typ.startsWith('image/') &&
        !typ.startsWith('audio/') &&
        !typ.startsWith('video/') && (
          <span className="flex items-center gap-2">
            <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate text-sm">{entry.filename ?? t.datei}</span>
          </span>
        )}
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{t.wartet}</p>
    </div>
  )
}

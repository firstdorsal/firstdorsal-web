import { useRef, useState } from 'react'
import { ImagePlus, Mic, Send, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    placeholder: 'Nachricht schreiben …',
    senden: 'Nachricht senden',
    bild: 'Bild anhängen',
    aufnehmen: 'Sprachnachricht aufnehmen',
    stoppen: 'Aufnahme beenden und senden',
    nimmtAuf: 'Aufnahme läuft …',
    keinMikro: 'Mikrofon nicht verfügbar.',
  },
  en: {
    placeholder: 'Write a message …',
    senden: 'Send message',
    bild: 'Attach image',
    aufnehmen: 'Record voice message',
    stoppen: 'Stop recording and send',
    nimmtAuf: 'Recording …',
    keinMikro: 'Microphone not available.',
  },
}

// Dateiendung passend zum Container, den der MediaRecorder gewählt hat.
function voiceFilename(mime: string): string {
  if (mime.includes('mp4')) return 'sprachnachricht.m4a'
  if (mime.includes('ogg')) return 'sprachnachricht.ogg'
  return 'sprachnachricht.webm'
}

// Gemeinsame Eingabezeile von Kunden-Widget und Admin-Panel: Text,
// Bild-Anhang und Sprachaufnahme (MediaRecorder, opus/webm – Safari mp4).
// Versand/Fehlerbehandlung liegt beim Aufrufer.
export function Composer({
  lang,
  onText,
  onMedia,
}: {
  lang: Lang
  onText: (text: string) => Promise<void>
  onMedia: (blob: Blob, filename: string) => Promise<void>
}) {
  const t = texte[lang]
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mikroFehler, setMikroFehler] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)

  async function textSenden(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      await onText(text)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  async function bildGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // gleiche Datei erneut wählbar
    if (file) await onMedia(file, file.name)
  }

  async function aufnahmeUmschalten() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    setMikroFehler(false)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMikroFehler(true)
      return
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) =>
      MediaRecorder.isTypeSupported(m),
    )
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunks.push(ev.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      setRecording(false)
      const type = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunks, { type })
      if (blob.size > 0) void onMedia(blob, voiceFilename(type))
    }
    recorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  return (
    <form onSubmit={textSenden} className="border-t border-border p-3">
      {mikroFehler && <p className="mb-2 text-xs text-destructive">{t.keinMikro}</p>}
      <div className="flex items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={bildGewaehlt}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t.bild}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant={recording ? 'destructive' : 'ghost'}
          size="icon"
          aria-label={recording ? t.stoppen : t.aufnehmen}
          onClick={aufnahmeUmschalten}
        >
          {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
        </Button>
        <input
          aria-label={t.placeholder}
          placeholder={recording ? t.nimmtAuf : t.placeholder}
          value={draft}
          disabled={recording}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" aria-label={t.senden} disabled={busy || recording}>
          <Send aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}

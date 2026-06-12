import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Mic, MicOff, Monitor, MonitorOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CallSession, type CallState } from '@/lib/call'
import type { SignalMessage } from '@/lib/chat'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    eingehend: 'Eingehender Anruf …',
    annehmenVideo: 'Mit Video annehmen',
    annehmenAudio: 'Nur Audio',
    ablehnen: 'Ablehnen',
    ruft: 'Ruft an …',
    verbinde: 'Verbinde …',
    auflegen: 'Auflegen',
    mikro: 'Mikrofon',
    kamera: 'Kamera',
    teilen: 'Bildschirm teilen',
    teilenStop: 'Teilen beenden',
    fehler: 'Anruf fehlgeschlagen.',
  },
  en: {
    eingehend: 'Incoming call …',
    annehmenVideo: 'Answer with video',
    annehmenAudio: 'Audio only',
    ablehnen: 'Decline',
    ruft: 'Calling …',
    verbinde: 'Connecting …',
    auflegen: 'Hang up',
    mikro: 'Microphone',
    kamera: 'Camera',
    teilen: 'Share screen',
    teilenStop: 'Stop sharing',
    fehler: 'Call failed.',
  },
}

export interface CallHandle {
  startCall: (video: boolean) => void
  onSignal: (msg: SignalMessage) => void
  active: boolean
}

// Anruf-Overlay über dem Chat: zeigt Klingeln/Verbindungsaufbau und im
// Gespräch die Videokacheln samt Steuerung (Mikro, Kamera, Screenshare,
// Auflegen). Die WebRTC-Logik steckt in CallSession; gesteuert wird sie
// vom Eltern-Element über die per ref herausgereichte CallHandle.
export const CallPanel = forwardRef<
  CallHandle,
  {
    lang: Lang
    /** true = Angerufener (Operator und Kunde sind beide möglich). */
    polite: boolean
    signal: (payload: Record<string, unknown>) => void
  }
>(function CallPanel({ lang, polite, signal }, ref) {
  const t = texte[lang]
  const [state, setState] = useState<CallState>('idle')
  const [fehler, setFehler] = useState('')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const sessionRef = useRef<CallSession | null>(null)
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)

  const ensureSession = useCallback(() => {
    if (!sessionRef.current) {
      sessionRef.current = new CallSession(
        signal,
        {
          onState: setState,
          onError: () => setFehler(t.fehler),
          onLocalStream: (stream) => {
            if (localRef.current) localRef.current.srcObject = stream
          },
          onRemoteStream: (stream) => {
            if (remoteRef.current) remoteRef.current.srcObject = stream
          },
        },
        polite,
      )
    }
    return sessionRef.current
  }, [signal, polite, t.fehler])

  // Nach Anrufende aufräumen.
  useEffect(() => {
    if (state === 'ended') {
      sessionRef.current = null
      setMicOn(true)
      setCamOn(true)
      setScreenOn(false)
      const id = setTimeout(() => setState('idle'), 50)
      return () => clearTimeout(id)
    }
  }, [state])

  useImperativeHandle(ref, () => ({
    active: state !== 'idle' && state !== 'ended',
    startCall: (video: boolean) => {
      setFehler('')
      setCamOn(video)
      void ensureSession().start(video)
    },
    onSignal: (msg: SignalMessage) => {
      void ensureSession().onSignal(msg)
    },
  }))

  if (state === 'idle' || state === 'ended') return null

  const imGespraech = state === 'connected' || state === 'connecting'

  return (
    <div data-testid="call-panel" data-call-state={state} className="absolute inset-0 z-10 flex flex-col bg-card">
      <div className="relative flex-1 overflow-hidden bg-black">
        {/* Gegenstelle groß, eigenes Bild als kleine Kachel. */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          data-testid="remote-video"
          className="h-full w-full object-contain"
        />
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute right-3 bottom-3 w-28 rounded-md border border-white/20 object-cover"
        />
        {!imGespraech && (
          <p className="absolute inset-x-0 top-6 text-center font-mono text-sm text-white/80">
            {state === 'ringing' ? t.eingehend : state === 'calling' ? t.ruft : t.verbinde}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-border p-3">
        {state === 'ringing' ? (
          <>
            <Button size="sm" onClick={() => ensureSession().accept(true)}>
              <Video aria-hidden="true" /> {t.annehmenVideo}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => ensureSession().accept(false)}>
              <Phone aria-hidden="true" /> {t.annehmenAudio}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              aria-label={t.ablehnen}
              onClick={() => sessionRef.current?.hangup()}
            >
              <PhoneOff aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant={micOn ? 'secondary' : 'outline'}
              aria-label={t.mikro}
              aria-pressed={micOn}
              onClick={() => setMicOn(sessionRef.current?.toggleTrack('audio') ?? true)}
            >
              {micOn ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
            </Button>
            <Button
              size="icon"
              variant={camOn ? 'secondary' : 'outline'}
              aria-label={t.kamera}
              aria-pressed={camOn}
              onClick={() => setCamOn(sessionRef.current?.toggleTrack('video') ?? false)}
            >
              {camOn ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}
            </Button>
            <Button
              size="icon"
              variant={screenOn ? 'default' : 'secondary'}
              aria-label={screenOn ? t.teilenStop : t.teilen}
              aria-pressed={screenOn}
              onClick={async () => setScreenOn((await sessionRef.current?.toggleScreenShare()) ?? false)}
            >
              {screenOn ? <MonitorOff aria-hidden="true" /> : <Monitor aria-hidden="true" />}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              aria-label={t.auflegen}
              onClick={() => sessionRef.current?.hangup()}
            >
              <PhoneOff aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
      {fehler && (
        <p className="bg-destructive/10 px-3 py-1 text-center text-xs text-destructive">{fehler}</p>
      )}
    </div>
  )
})

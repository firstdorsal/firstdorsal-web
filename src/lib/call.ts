// WebRTC-Sprach-/Videoanrufe inkl. Screensharing. Die Signalisierung
// (Offer/Answer/ICE/Steuerung) läuft über den bestehenden Chat-WebSocket
// und wird vom Server zwischen den beiden Teilnehmern einer Konversation
// weitergereicht; die Medien selbst laufen P2P. Genau ein aktiver Anruf
// je Konversation.

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'

export interface CallCallbacks {
  onState: (state: CallState) => void
  onRemoteStream: (stream: MediaStream) => void
  onLocalStream: (stream: MediaStream) => void
  /** Screenshare des Gegenübers gestartet/gestoppt (nur Info für die UI). */
  onError?: (message: string) => void
}

/** Signalisierungsnachricht über den WebSocket senden. */
export type SignalSender = (payload: Record<string, unknown>) => void

interface IceConfig {
  iceServers: RTCIceServer[]
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/chat/api/ice')
    if (!res.ok) return []
    return ((await res.json()) as IceConfig).iceServers ?? []
  } catch {
    return []
  }
}

// Eine Anruf-Sitzung kapselt genau eine RTCPeerConnection. Der Anrufer
// ruft start() (erzeugt das Offer), der Angerufene accept() nach einer
// eingehenden Offer. Beide Seiten teilen sich dieselbe Signalisierung.
export class CallSession {
  private pc: RTCPeerConnection | null = null
  private local: MediaStream | null = null
  private camTrack: MediaStreamTrack | null = null
  private screenStream: MediaStream | null = null
  private pendingOffer: RTCSessionDescriptionInit | null = null
  private polite: boolean

  constructor(
    private signal: SignalSender,
    private cb: CallCallbacks,
    /** true = Angerufener (löst Glare zugunsten des Anrufers auf). */
    polite: boolean,
  ) {
    this.polite = polite
  }

  /** true, wenn gerade ein Anruf läuft oder aufgebaut wird. */
  get active(): boolean {
    return this.pc !== null
  }

  private async createPc(video: boolean): Promise<RTCPeerConnection> {
    const iceServers = await fetchIceServers()
    const pc = new RTCPeerConnection({ iceServers })
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal({ kind: 'ice', candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => this.cb.onRemoteStream(e.streams[0])
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') this.cb.onState('connected')
      else if (s === 'failed' || s === 'disconnected' || s === 'closed') this.hangup()
    }

    const local = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    this.local = local
    this.camTrack = local.getVideoTracks()[0] ?? null
    for (const track of local.getTracks()) pc.addTrack(track, local)
    this.cb.onLocalStream(local)
    this.pc = pc
    return pc
  }

  /** Anruf starten (Anrufer): Medien holen, Offer senden. */
  async start(video: boolean): Promise<void> {
    try {
      this.cb.onState('calling')
      const pc = await this.createPc(video)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.signal({ kind: 'offer', sdp: offer, video })
    } catch (e) {
      this.cb.onError?.(fehlertext(e))
      this.hangup()
    }
  }

  /** Eingehende Offer merken und „ringing" anzeigen (Angerufener). */
  incomingOffer(sdp: RTCSessionDescriptionInit): void {
    this.pendingOffer = sdp
    this.cb.onState('ringing')
  }

  /** Eingehenden Anruf annehmen: Medien holen, Answer senden. */
  async accept(video: boolean): Promise<void> {
    if (!this.pendingOffer) return
    try {
      this.cb.onState('connecting')
      const pc = await this.createPc(video)
      await pc.setRemoteDescription(this.pendingOffer)
      this.pendingOffer = null
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      this.signal({ kind: 'answer', sdp: answer })
    } catch (e) {
      this.cb.onError?.(fehlertext(e))
      this.hangup()
    }
  }

  /** Eingehende Signalisierung von der Gegenstelle verarbeiten. */
  async onSignal(msg: Record<string, unknown>): Promise<void> {
    const kind = msg.kind as string
    try {
      if (kind === 'offer') {
        this.incomingOffer(msg.sdp as RTCSessionDescriptionInit)
      } else if (kind === 'answer' && this.pc) {
        await this.pc.setRemoteDescription(msg.sdp as RTCSessionDescriptionInit)
      } else if (kind === 'ice' && this.pc) {
        await this.pc.addIceCandidate(msg.candidate as RTCIceCandidateInit).catch(() => {})
      } else if (kind === 'hangup') {
        this.hangup(false)
      }
    } catch (e) {
      this.cb.onError?.(fehlertext(e))
    }
  }

  /** Kamera/Mikrofon stummschalten. */
  toggleTrack(kind: 'audio' | 'video'): boolean {
    const track =
      kind === 'audio' ? this.local?.getAudioTracks()[0] : this.local?.getVideoTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    return track.enabled
  }

  /** Bildschirm teilen bzw. wieder zur Kamera zurückkehren. */
  async toggleScreenShare(): Promise<boolean> {
    const sender = this.pc?.getSenders().find((s) => s.track?.kind === 'video')
    if (!sender) return false
    if (this.screenStream) {
      // Zurück zur Kamera.
      this.screenStream.getTracks().forEach((t) => t.stop())
      this.screenStream = null
      await sender.replaceTrack(this.camTrack)
      return false
    }
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true })
    this.screenStream = display
    const screenTrack = display.getVideoTracks()[0]
    // Beendet der Nutzer das Teilen über die Browserleiste, zurückschalten.
    screenTrack.onended = () => void this.toggleScreenShare()
    await sender.replaceTrack(screenTrack)
    return true
  }

  /** Auflegen; sendet standardmäßig auch das hangup-Signal. */
  hangup(notify = true): void {
    if (notify && this.pc) this.signal({ kind: 'hangup' })
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.local?.getTracks().forEach((t) => t.stop())
    this.pc?.close()
    this.pc = null
    this.local = null
    this.camTrack = null
    this.screenStream = null
    this.pendingOffer = null
    this.cb.onState('ended')
  }
}

function fehlertext(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

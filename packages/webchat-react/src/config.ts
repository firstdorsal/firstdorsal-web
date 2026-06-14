// Laufzeit-Konfiguration des Clients. Markenneutral und wiederverwendbar:
// Der Basis-Pfad, unter dem der webchat-Dienst erreichbar ist, lässt sich
// einmalig setzen (Standard `/chat`, wie vom mitgelieferten axum-Backend
// per Same-Origin ausgeliefert). Alle REST-Aufrufe und der WebSocket
// leiten sich daraus ab.

let basePath = '/chat'

export interface WebchatConfig {
  /** Basis-Pfad des Dienstes ohne abschließenden Slash, z. B. `/chat`. */
  basePath?: string
}

/** Globale Client-Konfiguration setzen (vor dem Mounten der Komponenten). */
export function configureWebchat(config: WebchatConfig): void {
  if (config.basePath != null) basePath = config.basePath.replace(/\/+$/, '')
}

/** Aktueller Basis-Pfad. */
export function getBasePath(): string {
  return basePath
}

/** REST-Pfad unterhalb von `<basePath>/api`, z. B. apiPath('/me'). */
export function apiPath(path: string): string {
  return `${basePath}/api${path}`
}

/** Vollständige WebSocket-URL (`<ws|wss>://host<basePath>/ws`). */
export function socketUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${basePath}/ws`
}

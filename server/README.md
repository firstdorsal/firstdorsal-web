# webchat – wiederverwendbarer Chat-Backend-Dienst

Ein eigenständiger, **markenneutraler** Chat-Server in Rust (axum). Er wurde
für die firstdorsal-Website gebaut, ist aber bewusst von ihr entkoppelt und
lässt sich in andere Projekte einbinden – das Frontend kommt dann von woanders
(z. B. mows-Komponenten), das Backend bleibt dieses hier.

> **Für Agents:** Dieses Dokument ist die maßgebliche Integrationsreferenz.
> Konfiguration läuft **ausschließlich über Umgebungsvariablen**, es gibt
> **keine projektspezifischen Codepfade**. Zum Adaptieren in ein neues Projekt
> reicht es, die ENV-Tabelle zu setzen und (optional) das Deployment aus
> `../deployment/` zu übernehmen. Nichts im Code referenziert „firstdorsal"
> außer Default-Werten, die per ENV überschrieben werden.

## Funktionsumfang

- **Magic-Link-Login** (passwortlos) per SMTP – getrennte Rollen `customer`
  und `operator` (Allowlist), Sessions im HttpOnly-Cookie
- **Echtzeit-Chat** über WebSocket (Push), Senden per REST
- **Anhänge**: Bilder, Sprachnachrichten, Videos, beliebige Dateien
  (content-addressed Storage, sichere Auslieferung)
- **Self-hosted Transkription** der Sprachnachrichten über ein
  whisper-asr-webservice (faster-whisper), asynchron nachgereicht
- **WebRTC-Signalisierung** für 1:1-Sprach-/Videoanrufe inkl. Screensharing
  (Relais zwischen den beiden Teilnehmern; ICE/TURN-Endpoint)
- **Cursor-Pagination** des Verlaufs (für endloses Scrollen im Frontend)
- **Optionale statische Auslieferung** eines Frontends (`STATIC_DIR`) – mit
  gesetztem Wert ist der Dienst Ein-Container-Webserver + Chat, ohne ist er
  ein reiner API-/WebSocket-Dienst

## Architektur

```
Frontend (beliebig)  ──REST /chat/api/**──►  webchat (axum)
                     ──WS   /chat/ws──────►   ├─ SQLite (sqlx) + Uploads → DATA_DIR
                                              ├─ SMTP (lettre)  → Magic-Links
                                              ├─ Whisper (HTTP) → Transkripte
                                              └─ STUN/TURN      → ICE für WebRTC
```

`src/lib.rs` ist die Bibliothek (Router-Builder + `run()`), `src/main.rs` ein
dünnes Binary darüber. Module: `api` (REST), `ws` (WebSocket + WebRTC-Relais),
`auth` (Magic-Link/Sessions/Rate-Limit), `mail`, `whisper`, `turn` (ICE),
`statics` (optionales Frontend), `db`, `config`.

## Konfiguration (Umgebungsvariablen)

| Variable | Default | Zweck |
| :-- | :-- | :-- |
| `PORT` | `8080` | Lauschport (Dual-Stack, IPv4-Fallback) |
| `BRAND_NAME` | `firstdorsal` | Markenname in E-Mails (Betreff/Signatur) |
| `PUBLIC_URL` | `https://firstdorsal.eu` | Basis-URL für Magic-Links + Cookie-`Secure` |
| `DATA_DIR` | `./data` | SQLite-DB + `uploads/` (beschreibbares Volume) |
| `STATIC_DIR` | – | Statisches Frontend ausliefern; leer = reiner API-Dienst |
| `OPERATOR_EMAILS` | – | Kommaliste der Adressen mit Operator-Zugang |
| `SMTP_HOST` | – | SMTP-Server; leer = Links nur ins Log (Dev) |
| `SMTP_PORT` | `465` | SMTP-Port |
| `SMTP_TLS` | `implicit` | `implicit` (465) oder `starttls` (587) |
| `SMTP_USER` / `SMTP_PASSWORD` | – | SMTP-Zugang |
| `MAIL_FROM` | `firstdorsal <mail@firstdorsal.eu>` | Absender |
| `CUSTOMER_REDIRECT` | `/?chat=open` | Ziel nach Kunden-Login (de) |
| `CUSTOMER_REDIRECT_EN` | `/en/?chat=open` | Ziel nach Kunden-Login (en) |
| `ADMIN_REDIRECT` | `/chat/admin/` | Ziel nach Operator-Login |
| `WHISPER_URL` | – | whisper-asr-webservice; leer = keine Transkription |
| `WHISPER_LANGUAGE` | – | Sprache erzwingen (z. B. `de`); leer = Autodetect |
| `STUN_URLS` | – | Kommaliste STUN-URLs für WebRTC |
| `TURN_URLS` | – | Kommaliste TURN-URLs |
| `TURN_SECRET` | – | coturn `use-auth-secret` (REST-Credentials) |
| `TURN_TTL` | `3600` | Gültigkeit der TURN-Credentials (s) |
| `MAIL_FILE_DIR` | – | **Nur Test:** Mails als Dateien statt Versand |
| `E2E_SEED` | – | **Nur Test:** Seed-Endpoint aktiv (`=1`) |

## HTTP-/WebSocket-API

Alle Chat-Routen liegen unter `/chat`. Auth über das Session-Cookie
(`fd_session`, HttpOnly). Fehler kommen als `{"error": "..."}`.

### Auth & Session
- `POST /chat/api/auth/request` `{email, lang}` → schickt Magic-Link
  (Rate-limitiert pro Adresse/IP). `lang` ∈ `de|en`.
- `GET  /chat/login?token=…` → verifiziert den Link, setzt das Cookie und
  leitet weiter (Kunde/Operator je nach Allowlist).
- `POST /chat/api/auth/logout` → Session beenden.
- `GET  /chat/api/me` → `{role, email}` oder 401.

### Kunde (eigene Konversation, implizit)
- `GET  /chat/api/messages?before=<id>&limit=<n>` → aufsteigende Seite.
- `POST /chat/api/messages` `{text}` → Textnachricht.
- `POST /chat/api/messages/media` (multipart `file`) → Anhang.
- `GET  /chat/api/attachments/{id}` → Blob (inline nur für Medien/PDF, sonst
  Download).

### Operator (Allowlist)
- `GET  /chat/api/admin/conversations` → Liste mit Ungelesen-Zähler.
- `GET  /chat/api/admin/conversations/{id}/messages?before=&limit=` → Seite.
- `POST /chat/api/admin/conversations/{id}/messages` `{text}` / `…/media`.
- `DELETE /chat/api/admin/conversations/{id}` → Konversation + Blobs löschen
  (DSGVO).

### Echtzeit & Anrufe
- `GET /chat/ws` (WebSocket): Server-Push von `{type:"message"|"transcript"}`;
  für Anrufe relayt der Server `{type:"signal", …}` (Offer/Answer/ICE/Hangup)
  zwischen den beiden Teilnehmern einer Konversation.
- `GET /chat/api/ice` → `{iceServers:[…]}` (STUN + zeitlich begrenzte
  TURN-Credentials).

### Betrieb
- `GET /health` → `OK`.

## Lokal starten

```bash
# reiner Backend-Dienst (Magic-Links landen im Log, ohne SMTP)
OPERATOR_EMAILS=du@example.org cargo run --manifest-path server/Cargo.toml
# mit statischem Frontend + Datei-Mails (wie in den E2E-Tests)
STATIC_DIR=../dist MAIL_FILE_DIR=/tmp/mails OPERATOR_EMAILS=op@example.org \
  cargo run --manifest-path server/Cargo.toml
```

## Als Bibliothek einbinden

```rust
// Cargo.toml:  webchat = { path = "../firstdorsal-web/server" }
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    webchat::run(webchat::Config::from_env()?).await
}
```

Feingranular (eigene Routen danebenhängen):

```rust
let state = webchat::AppState::init(webchat::Config::from_env()?).await?;
let app: axum::Router = webchat::build_router(state);
// app.merge(meine_routen) … selbst servieren
```

## Deployment

Siehe `../deployment/` (Docker Compose + Traefik): der `webchat`-Container,
ein interner Whisper-Container und optional coturn (WebRTC-Relay). Secrets über
`provided-secrets.env` (Vorlage: `provided-secrets.env.example`). Das Image
baut `../Dockerfile` (Node→Astro, dann Rust→musl, Tests laufen mit).

## Tests

- `cargo test --manifest-path server/Cargo.toml` – Unit-Tests (Auth, ICE-HMAC).
- Die End-to-End-Abläufe liegen im Wurzelprojekt unter `../e2e/` (Playwright
  gegen das echte Binary samt echtem Whisper-Container).

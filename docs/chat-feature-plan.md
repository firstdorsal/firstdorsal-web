# Feature-Plan: Kunden-Chat mit Magic-Link, Medien & self-hosted Transkription

Status: **Entwurf zur Abstimmung** (noch kein Code außer diesem Dokument)
Branch: `claude/website-customer-chat-7as4tb`

Ziel: Bessere Kundenakquise. Interessenten öffnen direkt auf der Website einen
Chat-Kanal zu Paul, geben ihre E-Mail ein, bestätigen per Magic-Link und chatten
dann in Echtzeit – inklusive **Sprachnachrichten** (self-hosted transkribiert)
und **Bildern**. Paul empfängt und beantwortet alles in einem eigenen,
Magic-Link-geschützten **Admin-Panel**.

Abgestimmte Eckpunkte (aus der Rückfrage):

- Betreiber-Seite: **eigenes Admin-Panel** (in die Website integriert)
- Backend-Stack: **Rust (axum)** – **liefert auch das statische Frontend aus**,
  alles in **einem Container** (ersetzt den bisherigen `static-web-server`)
- E-Mail-Versand: **vorhandener SMTP-Server** (Zugangsdaten via Secret)
- Umfang dieser Session: **erst dieser Plan**, danach phasenweise Umsetzung

---

## 1. Leitplanken aus dem Bestand

Die Website ist heute bewusst **statisch**: Astro → `static-web-server` auf
`scratch`, hinter Traefik, read-only Container im `rp`-Netz, manuelles Deploy
per `mpm compose` auf „turing". Self-hosted-Philosophie: kein CDN, eigene
Fonts, Mail-Adresse gegen Scraper geschützt, DSGVO-bewusst (eigene
`datenschutz.astro`).

Konsequenzen für das Feature:

- Der Chat braucht einen **dynamischen Backend-Dienst**. Entscheidung: **ein
  Container** – der axum-Dienst liefert das gebaute Astro-`dist/` gleich mit
  aus und **ersetzt den `static-web-server`** (samt `sws.toml`). Dessen
  Verhalten (Security-Header, Kompression, Cache-Strategie, `/health`) wird
  in axum/tower-http nachgebildet.
- Der Dienst fügt sich in dasselbe Muster ein: read-only Root-FS +
  beschreibbares Volume, hinter Traefik, Secrets über `provided-secrets.env`
  (bereits in `deployment/.gitignore`).
- Optik & Sprache: Das Widget folgt dem „Anatomische Tafel"-Theme
  (`global.css`-Tokens, `font-serif`/`annotation`/`label-caps`) und dem
  DE/EN-Muster (`lang`-Prop + lokales Wörterbuch wie in `Kontakt.tsx`).

---

## 2. Architektur im Überblick

```
                          ┌──────────────────────── turing (Docker, rp-Netz) ────────────────────────┐
                          │                                                                          │
  Browser (Kunde)         │   Traefik (TLS)                                                          │
  ┌───────────────┐       │   └─ Host firstdorsal.eu ──► firstdorsal-web (Rust/axum, EIN Container)  │
  │ Astro-Seite   │       │            ├─ statische Dateien (Astro-dist/, ins Image gebacken)        │
  │  + Chat-Widget│──────►│            ├─ /chat/api/** (REST) und /chat/ws (WebSocket)               │
  │   (React-Insel)│      │            ├─ SQLite + Uploads ──► Volume /data (beschreibbar)           │
  └───────────────┘       │            ├─ SMTP ──────────────► vorhandener Mailserver (extern)       │
                          │            └─(internes Netz)────► firstdorsal-whisper (whisper.cpp)      │
  Browser (Paul/Admin)    │                                    (nicht über Traefik exponiert)         │
  ┌───────────────┐       │                                                                          │
  │ /chat/admin   │──────►│                                                                          │
  └───────────────┘       │                                                                          │
                          └──────────────────────────────────────────────────────────────────────────┘
```

**Ein Container für alles** (außer Whisper): axum liefert das statische
Astro-`dist/` aus **und** bedient `/chat/api/**` + `/chat/ws`. Traefik-Routing
bleibt so simpel wie heute (ein Router, ein Zertifikat), Same-Origin ohne
CORS-Sonderfälle, Session-Cookie sauber auf der Apex-Domain. Der
`static-web-server` und `sws.toml` entfallen.

Begründung der übrigen Wahl gegenüber Alternativen:

- **SQLite** (statt Postgres): Single-Node, geringe Last (Akquise-Chat), eine
  Datei auf dem Volume, WAL-Modus, kein zweiter DB-Container. Über `sqlx` mit
  compile-time-geprüften Queries. Migration auf Postgres bleibt später möglich.
- **Separater Whisper-Container** (statt `whisper-rs` eingebettet): hält das
  große Modell und die CPU-/GPU-Last aus dem Chat-Dienst heraus, macht dessen
  Image klein und das Root-FS read-only-tauglich. Kommuniziert nur über das
  interne Netz, nicht über Traefik exponiert.

---

## 3. Komponenten

### 3.1 Rust-Dienst `firstdorsal-web` (Backend **und** Frontend-Auslieferung)

- **Framework:** `axum` (auf `tokio`/`tower`) – integrierte WebSockets,
  Middleware, Multipart-Uploads.
- **Statische Auslieferung** des Astro-`dist/` über `tower-http::ServeDir`
  (Fallback-Route hinter den `/chat`-Routen). Die heutige SWS-Konfiguration
  wird nachgebildet:
  - Cache-Strategie: HTML `Cache-Control: no-cache` (+ ETag), `/_astro/**`
    `public, max-age=31536000, immutable`, Icons 1 Tag
  - Kompression: Brotli/Gzip via `CompressionLayer` (oder vorab komprimierte
    Dateien aus dem Build via `ServeDir::precompressed_*`)
  - Security-Header als Middleware, `/health` für Deployment-Checks
- **DB:** `sqlx` + **SQLite** (WAL), Migrationen im Repo (`migrations/`).
- **Auth:** Magic-Link. E-Mail → Einmal-Token (nur Hash gespeichert, kurze
  Gültigkeit) → Versand per SMTP → Klick setzt **HttpOnly/Secure/SameSite**-
  Session-Cookie. Getrennte Zwecke `customer` und `operator` (Paul per
  Allowlist).
- **E-Mail:** `lettre` (SMTP, STARTTLS/implicit TLS, Zugangsdaten aus Env/Secret).
- **Echtzeit:** WebSocket je Konversation; Nachricht wird erst persistiert, dann
  über einen `tokio::broadcast`-Kanal an verbundene Teilnehmer (Kunde + Admin)
  gepusht. Reconnect-fähig, Nachrichtenverlauf wird beim Verbinden nachgeladen.
- **Storage:** Blobs (Bild/Audio) auf dem Volume unter `/data/uploads`
  (content-addressed via SHA-256), Metadaten in der DB. Upload-Limits +
  MIME-Allowlist.
- **Transkription:** Audio wird nach Upload an den Whisper-Dienst geschickt
  (asynchroner Job), Transkript gespeichert und per WebSocket nachgereicht
  („Transkription läuft…" → fertiger Text unter der Sprachnachricht).

### 3.2 Transkriptions-Dienst `firstdorsal-whisper`

- **`whisper.cpp` Server-Binary** (HTTP-`/inference`) im eigenen Container,
  Modell auf einem Volume.
- **Modell-Empfehlung:** `ggml-large-v3-turbo` (gute deutsche Qualität, deutlich
  schneller als large-v3) oder `ggml-medium` als ressourcenschonende Alternative.
  CPU-only lauffähig; GPU optional, falls auf turing verfügbar.
- Nimmt das hochgeladene Audio (z. B. opus/webm → intern zu 16-kHz-WAV
  konvertiert) und liefert Text + erkannte Sprache (de/en) zurück.

### 3.3 Frontend – Chat-Widget (Kunde)

- **React-Insel** (`client:load`/`client:idle`), eingebunden wie die bestehenden
  Inseln; floatender Launcher unten rechts, der ein Panel im Tafel-Stil öffnet.
- **Zustände:** geschlossen → offen → E-Mail-Eingabe → „Bitte E-Mail
  bestätigen" → (nach Magic-Link) Chat-Ansicht.
- **Chat-Ansicht:** Nachrichtenliste, Texteingabe, Bild anhängen
  (`<input type=file>`, optional clientseitig verkleinert), Sprachnachricht
  aufnehmen (`MediaRecorder`, opus/webm), Audio-Player + Transkript-Anzeige.
- **WebSocket-Client** mit Auto-Reconnect und optimistischem Senden.
- **DE/EN** über `lang`-Prop + lokales Wörterbuch (Muster aus `Kontakt.tsx`).

### 3.4 Frontend – Admin-Panel (Paul)

- Route `/chat/admin` (eigene Astro-Seite mit React-Insel), Magic-Link-Login auf
  die Operator-Allowlist beschränkt.
- Konversationsliste (mit ungelesen-Markierung, letzter Nachricht, Kunden-Mail),
  Detailansicht mit Antwort-Eingabe, Bild/Sprachnachricht-Wiedergabe inkl.
  Transkript. Gleicher WebSocket-/REST-Unterbau wie das Kunden-Widget.

---

## 4. Datenmodell (SQLite)

- `customers (id, email, created_at, last_seen_at)`
- `operators (id, email)` – Allowlist für Admin-Zugang
- `conversations (id, customer_id, status, created_at, last_message_at)`
- `messages (id, conversation_id, sender['customer'|'operator'],
  kind['text'|'image'|'voice'], body_text, attachment_id, created_at, read_at)`
- `attachments (id, kind, mime, size, sha256, duration_ms,
  transcript, transcript_status['pending'|'done'|'failed'])`
- `magic_links (id, email, purpose['customer'|'operator'], token_hash,
  expires_at, used_at)`
- `sessions (id, token_hash, subject_type, subject_id, expires_at, created_at)`

---

## 5. Sicherheit & DSGVO (für eine deutsche Gewerbe-Seite zentral)

- **Magic-Link:** Tokens nur als Hash gespeichert, einmalig verwendbar, kurze
  Gültigkeit; **Rate-Limit** pro E-Mail/IP gegen Mail-Bombing.
- **Sessions:** Cookies `HttpOnly; Secure; SameSite=Lax`, serverseitig
  widerrufbar; getrennte Operator-/Kunden-Scopes.
- **Uploads:** Größenlimit, MIME-Allowlist (nur Bilder/Audio), keine Ausführung,
  Auslieferung mit `Content-Disposition`/sicheren Headern.
- **Content-Security-Policy:** `connect-src` für den WebSocket ergänzen
  (heute liefert SWS `security-headers`); CSP für die Seite definieren.
- **Datensparsamkeit/DSGVO:** Sprach- und Bilddaten sind sensibel. Nötig:
  Einwilligung beim Chat-Start, Aktualisierung der **`datenschutz.astro`**
  (Zweck, Rechtsgrundlage, Speicherdauer, Auftragsverarbeitung Mailserver),
  konfigurierbare **Aufbewahrungsfrist** mit automatischer Löschung, Möglichkeit
  zum Löschen einer Konversation. Transkription läuft **self-hosted** – es
  verlassen keine Audiodaten den Server (genau wie gewünscht).

---

## 6. Deployment-Umbau

- `deployment/templates/docker-compose.yaml`:
  - `firstdorsal-web` wird zum axum-Container (gleicher Name, gleiche
    Traefik-Labels wie heute – Router/TLS/www-Redirect bleiben unverändert);
    zusätzlich internes Netz zum Whisper-Dienst, read-only Root-FS +
    Volume `/data` (SQLite + Uploads), `no-new-privileges`.
  - Neu: `firstdorsal-whisper` – nur am internen Netz, Modell auf eigenem
    Volume, **nicht** über Traefik exponiert.
- **Secrets:** SMTP-Zugang, Session-/Token-Signaturschlüssel, Operator-E-Mail
  über `provided-secrets.env` (gitignored) bzw. `values.yaml`.
- **Build/CI:** Die bestehende `Dockerfile` wird Multi-Stage erweitert:
  Stage 1 Node/pnpm (Tests + Astro-Build wie heute), Stage 2 Rust
  (`cargo-chef` für Cache, `cargo test` im Build), Laufzeit-Stage: schlankes
  Basis-Image (distroless/`scratch` bei musl-Build) mit axum-Binary +
  `dist/`. `build.sh`, Pipeline und `deploy.sh` bleiben im Ablauf identisch –
  ein Image, ein Push, ein `mpm compose up`. `sws.toml` entfällt.

---

## 7. Vorgeschlagene Repo-Struktur

```
server/                    Rust-Service (Cargo-Projekt)
  Cargo.toml
  src/                     axum-App: statische Auslieferung, Auth, WS,
                           Uploads, Whisper-Client
  migrations/              SQLite-Migrationen (sqlx)
src/components/chat/        Kunden-Widget + Admin-Panel (React-Inseln)
src/pages/chat/admin.astro  Admin-Seite (Insel-Host)
Dockerfile                 Multi-Stage: Node (Astro) → Rust → Laufzeit-Image
deployment/                erweitertes compose + values + Secret-Vorlage
docs/chat-feature-plan.md   dieses Dokument
```

---

## 8. Phasenplan

- **Phase 0 – Plan** (dieses Dokument). ✅
- **Phase 1 – axum-Fundament & Text-Chat (MVP):** axum-Dienst, der das
  Astro-`dist/` ausliefert (Header/Caching/Kompression wie SWS, `/health`) und
  den SWS im Image ersetzt; SQLite; Magic-Link (Kunde + Operator) + Sessions +
  SMTP (`lettre`); WebSocket-Text-Chat; Widget (Launcher → E-Mail → Chat) +
  Basis-Admin-Panel; Multi-Stage-Dockerfile, Volume, Secrets, CI-Build. ✅
- **Phase 2 – Bilder:** Multipart-Upload (Allowlist, Limits), content-addressed
  Blobs, authentifizierte Attachment-Route, Anzeige in Widget & Admin. ✅
- **Phase 3 – Sprachnachrichten:** `MediaRecorder`-Aufnahme im gemeinsamen
  Composer, Upload, Audio-Player. ✅
- **Phase 4 – Transkription:** whisper-asr-webservice-Container (faster-whisper,
  CPU), asynchroner Job, Transkript per WebSocket nachgereicht. ✅
- **Phase 4b – PWA & Offline:** Manifest + Service Worker (installierbar,
  Seiten/Assets offline); Chat-Outbox in IndexedDB – Text wie Medien werden
  offline gesammelt und beim Online-Gehen gesendet, Verlauf offline lesbar. ✅
- **Phase 4c – Playwright-E2E:** komplette Abläufe gegen den echten Stack
  (Rust-Server + echtes Whisper-Image mit tiny-Modell): Magic-Link-Login,
  Text live in beide Richtungen, Bild, Sprachnachricht aus echter Sprachprobe
  (Fake-Mikrofon) mit echter Transkription, Offline-Outbox-Roundtrip. ✅
- **Phase 5 – Politur (offen):** Operator-Benachrichtigung per E-Mail bei
  neuer Nachricht, Tipp-/Lese-Indikatoren, `datenschutz.astro`-Update
  (Pflicht vor Launch!), 512px-Maskable-Icon fürs Manifest, CSP.

---

## 9. Entschiedene Punkte

1. **Routing:** Same-Origin-Pfad-Routing (`/chat/...`) – ohnehin ein Container.
2. **Whisper:** **keine GPU** auf turing → CPU-Inferenz; Modell
   `large-v3-turbo` (quantisiert) als Standard, per Konfiguration auf `medium`
   wechselbar. Transkription läuft asynchron, kurze Wartezeit ist okay.
3. **Aufbewahrung:** **unbegrenzt** – keine Auto-Löschung; manuelles Löschen
   einzelner Konversationen im Admin-Panel bleibt möglich (DSGVO-Auskunft/
   Löschung auf Anfrage, so auch in `datenschutz.astro` zu formulieren).
4. **SMTP:** vorhandener Account, **TLS** (implicit TLS, Port 465; STARTTLS
   konfigurierbar). Zugangsdaten via `provided-secrets.env`.
5. **Operator-Benachrichtigung:** Standard **E-Mail** über denselben
   SMTP-Account (Phase 5), Web-Push optional später.

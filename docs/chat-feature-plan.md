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
- Backend-Stack: **Rust**
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

- Der Chat braucht zwingend einen **dynamischen Backend-Dienst** – die statische
  Auslieferung bleibt davon unberührt.
- Der neue Dienst fügt sich in dasselbe Muster ein: eigener Container,
  read-only Root-FS + beschreibbares Volume, hinter Traefik, Secrets über
  `provided-secrets.env` (bereits in `deployment/.gitignore`).
- Optik & Sprache: Das Widget folgt dem „Anatomische Tafel"-Theme
  (`global.css`-Tokens, `font-serif`/`annotation`/`label-caps`) und dem
  DE/EN-Muster (`lang`-Prop + lokales Wörterbuch wie in `Kontakt.tsx`).

---

## 2. Architektur im Überblick

```
                          ┌───────────────────────── turing (Docker, rp-Netz) ─────────────────────────┐
                          │                                                                            │
  Browser (Kunde)         │   Traefik (TLS)                                                            │
  ┌───────────────┐       │   ├─ Host firstdorsal.eu, Pfad /chat/api/**, /chat/ws  ─► firstdorsal-chat │
  │ Astro-Seite   │       │   │                                              (Rust/axum)               │
  │  + Chat-Widget│──────►│   └─ sonst Host firstdorsal.eu                  ─► firstdorsal-web (SWS)    │
  │   (React-Insel)│      │                                                       (statisch, scratch)   │
  └───────────────┘       │                                                                            │
                          │   firstdorsal-chat ──(internes Netz)──► firstdorsal-whisper (whisper.cpp)  │
  Browser (Paul/Admin)    │        │                                                                    │
  ┌───────────────┐       │        ├─ SQLite + Uploads  ──►  Volume /data (beschreibbar)               │
  │ /chat/admin   │──────►│        └─ SMTP  ──────────────►  vorhandener Mailserver (extern)           │
  └───────────────┘       │                                                                            │
                          └────────────────────────────────────────────────────────────────────────────┘
```

**Same-Origin per Pfad-Routing** statt Subdomain: Traefik bekommt einen Router
mit höherer Priorität, der `firstdorsal.eu/chat/api/**` und `/chat/ws` an den
Rust-Dienst leitet; alles andere bleibt beim statischen Server. Vorteil: keine
CORS-Sonderfälle, Session-Cookie sauber auf der Apex-Domain, ein TLS-Zertifikat.

Begründung der Wahl gegenüber Alternativen:

- **SQLite** (statt Postgres): Single-Node, geringe Last (Akquise-Chat), eine
  Datei auf dem Volume, WAL-Modus, kein zweiter DB-Container. Über `sqlx` mit
  compile-time-geprüften Queries. Migration auf Postgres bleibt später möglich.
- **Separater Whisper-Container** (statt `whisper-rs` eingebettet): hält das
  große Modell und die CPU-/GPU-Last aus dem Chat-Dienst heraus, macht dessen
  Image klein und das Root-FS read-only-tauglich. Kommuniziert nur über das
  interne Netz, nicht über Traefik exponiert.

---

## 3. Komponenten

### 3.1 Rust-Backend `firstdorsal-chat`

- **Framework:** `axum` (auf `tokio`/`tower`) – integrierte WebSockets,
  Middleware, Multipart-Uploads.
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

## 6. Deployment-Erweiterung

- `deployment/templates/docker-compose.yaml` bekommt zwei neue Services:
  - `firstdorsal-chat` (Rust): am `rp`-Netz für Traefik **und** an einem
    internen Netz zum Whisper-Dienst; read-only Root-FS + Volume `/data`
    (SQLite + Uploads); `no-new-privileges`.
  - `firstdorsal-whisper`: nur am internen Netz, Modell auf eigenem Volume,
    **nicht** über Traefik exponiert.
- **Traefik-Labels:** Router mit höherer Priorität für
  `Host(firstdorsal.eu) && (PathPrefix(/chat/api) || Path(/chat/ws))` →
  `firstdorsal-chat`; bestehender statischer Router bleibt Fallback.
- **Secrets:** SMTP-Zugang, Session-/Token-Signaturschlüssel, Operator-E-Mail
  über `provided-secrets.env` (gitignored) bzw. `values.yaml`.
- **Build/CI:** Eigene `Dockerfile` im `chat-backend/` (Multi-Stage Rust,
  `cargo-chef` für Cache, `cargo test` im Build wie heute `pnpm test`).
  `.github/workflows/` um einen Build-/Push-Schritt für das Chat-Image
  erweitern; `deploy.sh` zieht beide Images.

---

## 7. Vorgeschlagene Repo-Struktur

```
chat-backend/              Rust-Service (Cargo-Projekt)
  Cargo.toml
  src/                     axum-App, Auth, WS, Uploads, Whisper-Client
  migrations/              SQLite-Migrationen (sqlx)
  Dockerfile
src/components/chat/        Kunden-Widget + Admin-Panel (React-Inseln)
src/pages/chat/admin.astro  Admin-Seite (Insel-Host)
deployment/                erweitertes compose + values + Secret-Vorlage
docs/chat-feature-plan.md   dieses Dokument
```

---

## 8. Phasenplan

- **Phase 0 – Plan** (dieses Dokument). ✅
- **Phase 1 – Text-Chat & Auth (MVP):** axum-Skelett + SQLite + Health;
  Magic-Link (Kunde + Operator) + Sessions + SMTP (`lettre`); WebSocket-Text-Chat;
  Widget (Launcher → E-Mail → Chat) + Basis-Admin-Panel; Traefik-Pfad-Routing,
  Volume, Secrets, CI-Build. **Lauffähiges Ende-zu-Ende-Fundament.**
- **Phase 2 – Bilder:** Upload, Limits/Thumbnails, Anzeige in Widget & Admin.
- **Phase 3 – Sprachnachrichten:** `MediaRecorder`-Aufnahme, Upload, Audio-Player.
- **Phase 4 – Transkription:** Whisper-Container, asynchroner Job, Transkript
  unter der Sprachnachricht (de/en).
- **Phase 5 – Politur:** Operator-Benachrichtigung (E-Mail/Web-Push bei neuer
  Nachricht), Tipp-/Lese-Indikatoren, Aufbewahrung/Auto-Löschung, Rate-Limits,
  `datenschutz.astro`-Update, Tests (Vitest + `cargo test`).

---

## 9. Offene Punkte zur Bestätigung

1. **Routing:** Same-Origin-Pfad `/chat/...` (empfohlen) oder Subdomain
   `chat.firstdorsal.eu`?
2. **Whisper-Modell:** `large-v3-turbo` (Qualität) vs. `medium`
   (ressourcenschonend) – und ist auf turing eine GPU verfügbar?
3. **Operator-Benachrichtigung:** Wie soll Paul über neue Nachrichten erfahren,
   wenn das Admin-Panel nicht offen ist (E-Mail / Web-Push / beides)?
4. **Aufbewahrungsfrist:** Wie lange sollen Konversationen + Medien gespeichert
   bleiben (z. B. 90/180 Tage), bevor automatisch gelöscht wird?
5. **SMTP-Details:** Host/Port/TLS-Modus, Absenderadresse, vorhandenes Konto?

Nach Freigabe dieses Plans (und Klärung der offenen Punkte) starte ich mit
**Phase 1**.

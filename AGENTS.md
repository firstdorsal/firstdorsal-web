# AGENTS.md – Orientierung für KI-Agenten

Diese Datei richtet sich an Coding-Agents (Claude Code & Co.), die in diesem
Repo arbeiten oder den hier enthaltenen Chat-Dienst in ein anderes Projekt
übernehmen. Sie fasst Aufbau, Befehle, Konventionen und Wiederverwendung
kompakt zusammen. Menschliche Doku: `README.md` (Website) und
`server/README.md` (Chat-Backend, maßgebliche Integrationsreferenz).

## Was das ist

Zwei Dinge in einem Repo:

1. **Website** `firstdorsal.eu` – Astro 6, statische Ausgabe, „Anatomische
   Tafel"-Gestaltung. Bewusst minimal JS (React nur als Inseln).
2. **`webchat`** (`server/`) – ein **wiederverwendbarer, markenneutraler**
   Chat-Backend-Dienst in Rust/axum (Magic-Link-Login, WebSocket-Chat,
   Datei-/Sprach-/Video-Uploads, Whisper-Transkription, WebRTC-Anrufe).
   Er liefert das gebaute Frontend optional gleich mit aus (`STATIC_DIR`).

Beide laufen in **einem Container** (axum serviert `dist/` + die Chat-API).
Whisper und coturn sind eigene Container. Deployment: Docker Compose hinter
Traefik, self-hosted (`deployment/`).

## Repo-Karte

```
src/                     Astro-Seite (Komponenten, Seiten, Layout, Styles)
  components/chat/        Chat-Frontend (React-Inseln): Widget, Admin, Anrufe
  lib/chat.ts|call.ts|offline.ts   Chat-Client (REST/WS, WebRTC, Offline-Outbox)
  pages/chat/admin.astro  Operator-Panel (noindex)
server/                  webchat – Rust-Backend (lib.rs + main.rs)
  src/{api,ws,auth,mail,whisper,turn,statics,db,config}.rs
  migrations/            SQLite-Schema (sqlx, eingebettet)
  README.md             ← Backend-Integrationsreferenz (ENV, API, Library)
e2e/                     Playwright gegen das echte Binary + echten Whisper
deployment/              Compose + Traefik + Secrets-Vorlage + Whisper/coturn
docs/chat-feature-plan.md  Architektur & Phasenplan des Chat-Features
Dockerfile               Multi-Stage: Node→Astro, dann Rust→musl (Tests inkl.)
```

## Befehle

| Zweck | Befehl |
| :-- | :-- |
| Dev-Server (Frontend) | `pnpm dev` (Port 4321; proxyt `/chat/*` → :8080) |
| Chat-Backend (Dev) | `cargo run --manifest-path server/Cargo.toml` |
| Frontend-Build | `pnpm build` → `dist/` |
| Unit-/Komponententests | `pnpm test` (Vitest) |
| Backend-Tests | `cargo test --manifest-path server/Cargo.toml` |
| End-to-End | `pnpm test:e2e` (**braucht Docker** für Whisper) |
| Image bauen (alles, Tests inkl.) | `bash build.sh` |

Nach Änderungen **immer** die passende Testebene grün halten: Frontend →
`pnpm test`, Backend → `cargo test`, durchgehende Abläufe → `pnpm test:e2e`.

## Konventionen (wichtig)

- **Kommentare und Doku auf Deutsch.** Code-Bezeichner gemischt dt./engl. wie
  im Bestand. Kommentare erklären das *Warum*, nicht das Offensichtliche.
- **Self-hosted-Ethos:** kein CDN, keine externen Abhängigkeiten zur Laufzeit
  (Fonts lokal, Transkription self-hosted, TLS-Roots ins Binary gebacken).
- **Theme:** Tailwind v4 + shadcn-Tokens (`bg-card`, `text-brand`,
  `border-border`, Utilities `annotation`, `label-caps`). Neue Chat-UI folgt
  diesen Tokens; Texte zweisprachig (`lang`-Prop + lokales Wörterbuch).
- **Sicherheit/DSGVO:** Magic-Link-Tokens nur als Hash, Sessions HttpOnly,
  Upload-Allowlist fürs Inline-Rendering, Konversationen manuell löschbar.
  Vor einem echten Launch die `datenschutz.astro` ergänzen.
- **Tests gehören dazu.** E2E nutzt **echte** Dienste (echtes Whisper-Image,
  echte WebRTC-Verbindung), keine Mocks.

## Den Chat-Dienst in ein anderes Projekt übernehmen

`webchat` ist von dieser Website entkoppelt. Es gibt **keine** projekt-
spezifischen Codepfade – alles läuft über Umgebungsvariablen
(`server/README.md`, ENV-Tabelle). Vorgehen für einen Agenten:

1. `server/` als Cargo-Crate übernehmen (Pfad-/Git-Dependency oder kopieren).
   Library: `webchat::run(Config::from_env()?)` oder
   `webchat::build_router(state)` zum Mounten unter eine eigene axum-App.
2. Branding/Verhalten per ENV setzen: mindestens `BRAND_NAME`, `MAIL_FROM`
   (Absender-Anzeigename – `BRAND_NAME` allein ändert den `From:` **nicht**),
   `PUBLIC_URL`, `OPERATOR_EMAILS` und die SMTP-Variablen. Ohne `STATIC_DIR`
   ist es ein **reiner API-/WebSocket-Dienst** – ideal, wenn das Frontend
   (z. B. mows-Komponenten) getrennt lebt.
3. Frontend anbinden: gegen die unter `server/README.md` dokumentierte API
   sprechen. Die hiesigen React-Komponenten sind als Referenz-Implementierung
   zu verstehen, nicht als verbindliches Paket.
4. Deployment aus `deployment/` adaptieren (Container, Volume `/data`,
   optional Whisper/coturn).

## Stolpersteine

- **`pnpm test:e2e` braucht einen laufenden Docker-Daemon** (startet das echte
  whisper-asr-webservice). Ohne Docker schlagen nur die E2E-Tests fehl.
- Das Laufzeit-Binary heißt **`webchat`** (Crate-Rename); der Dockerfile
  kopiert `target/release/webchat`.
- `DATA_DIR` muss beschreibbar sein (SQLite + Uploads); der Container ist sonst
  read-only.
- Magic-Links ohne `SMTP_HOST` landen nur im Log; mit `MAIL_FILE_DIR` als
  Dateien (so liest sie der E2E-Test).
- WebRTC: ohne `TURN_*` klappen Anrufe direkt/per STUN; coturn deckt strenge
  NATs ab (Deployment-Kommentar erklärt das Port-/Traefik-Thema).

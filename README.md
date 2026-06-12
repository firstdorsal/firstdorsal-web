# firstdorsal-web

Gewerbe-Website von **firstdorsal IT-Dienstleistungen** (Paul Colin Hennig).

## Gestaltungskonzept „Anatomische Tafel"

Der Name **firstdorsal** stammt vom ersten Brustwirbel (*1st dorsal vertebra*)
einer alten anatomischen Zeichnung. Die Gestaltung greift das auf:

- **Hell** = warmes Sepia-Papier mit Tusche, **Dunkel** = tiefes
  Tinten-Schwarzbraun (das Negativ der Tafel); Akzentfarbe Siena (oxidierte,
  orange-braune Tusche), Token `--brand` / Utility `text-brand`
- Kursive Serifen-**Anmerkungen** (`annotation`) wie die Beschriftung „1st dorsal",
  letterspaced Versalien-**Labels** (`label-caps`) wie die Film-Credits der Vorlage
- Nummerierte Abschnitte („1 –", „2 –", …) und Leistungs-„Tafeln" (I–III) wie in
  einem Atlas; Hero-Illustration: stilisierte Wirbelsäule (`SpineIllustration`),
  Bildmarke: drei Wirbel (`SpineMark`, auch Favicon)
- Papierkorn + Vignette als fixe Ebene (`.texture-overlay` in `global.css`)

## Stack

- **Astro 6** (statische Ausgabe, kein unnötiges JS)
- **React** als Inseln über `@astrojs/react` – nur für interaktive Teile
  (Theme-Toggle, Kunden-Chat); shadcn-Komponenten werden ansonsten statisch
  gerendert
- **Tailwind v4** (`@tailwindcss/vite`) + **shadcn/ui** (Style „new-york", lucide)
- **Schriften lokal, kein CDN:** Fraunces (Display/Anmerkungen) und Libre Franklin
  (Fließtext/Labels) via `@fontsource-variable/*`, **Hack** als self-gehostete
  woff2 (`src/fonts/`) für Monospace
- **Dark/Light:** Inline-Skript im Layout (kein Flackern) + `ModeToggle`-Insel,
  Auswahl in `localStorage` (`fd-theme`)
- **Motion:** Hero rein per CSS-Keyframes (`anim-rise`), Scroll-Einblendungen per
  IntersectionObserver (`.reveal`, nur bei `html.js`, respektiert
  `prefers-reduced-motion`)
- **Server:** ein **Rust/axum**-Binary (`server/`) liefert das gebaute `dist/`
  aus (Cache-/Security-Header wie früher beim static-web-server) und bedient
  den **Kunden-Chat**: Magic-Link-Login (SMTP via lettre), SQLite (sqlx),
  WebSocket-Push, Bild-/Sprachnachrichten-Uploads, self-hosted Transkription
  über das whisper-asr-webservice – Details in `docs/chat-feature-plan.md`
- **PWA:** Manifest + Service Worker (`public/sw.js`); der Chat sammelt
  Nachrichten offline in einer IndexedDB-Outbox (`src/lib/offline.ts`) und
  sendet sie beim nächsten Online-Gehen
- **Tests:** Vitest + Testing-Library (Unit/Komponenten), **Playwright**
  (`e2e/`) gegen den echten Rust-Server samt echtem Whisper-Container

## Build & Deployment

- **`bash build.sh`** baut das Docker-Image vollständig im Container
  (Node 22 + pnpm → Astro-Build, dann Rust/musl → statisches Binary; Vitest
  und `cargo test` laufen im Build mit). Laufzeit-Image: das axum-Binary +
  `dist/` auf scratch-Basis (`RUNTIME_FLAVOR="-alpine"` für eine
  Debug-Shell). Mit `PUSH=1` wird nach
  `ghcr.io/firstdorsal/firstdorsal-web` gepusht.
- **GitHub Actions** (`.github/workflows/build.yml`) ruft bei jedem Push auf
  `main` nur `build.sh` auf (mit `PUSH=1`) – Pipeline und lokaler Ablauf
  sind identisch.
- **`bash deploy.sh`** deployt manuell auf turing (SSH-Zugang nötig, z. B.
  aus dem LAN): aktualisiert den Checkout unter
  `/mnt/alpha/manifest/server/public/firstdorsal-web` und führt
  `mpm compose up` aus, das das Pipeline-Image aus der Registry zieht.
- **mpm-Deployment** in `deployment/` (mows-cli): Traefik-Routing für
  `firstdorsal.eu` (+ `www`-Redirect), TLS über den DNS-Challenge-Resolver,
  Container read-only im `rp`-Netz; dazu das `/data`-Volume (SQLite +
  Uploads), der interne **Whisper-Container** (`firstdorsal-whisper`,
  Modell in `values.yaml`) und die Secrets-Datei
  `deployment/provided-secrets.env` (Vorlage: `provided-secrets.env.example`).

## Befehle

| Befehl           | Wirkung                                                         |
| :--------------- | :-------------------------------------------------------------- |
| `pnpm dev`       | Dev-Server mit Hot-Reload (`localhost:4321`)                     |
| `pnpm build`     | Statische Seite nach `./dist/` bauen                             |
| `pnpm preview`   | Produktions-Build lokal ansehen                                  |
| `pnpm test`      | Vitest-Tests einmalig ausführen                                  |
| `pnpm test:e2e`  | Playwright-E2E (startet Rust-Server + Whisper; braucht Docker)   |

Für den Chat im Dev-Modus läuft das Backend separat:
`cargo run --manifest-path server/Cargo.toml` (Port 8080; ohne `SMTP_HOST`
landen die Magic-Links im Log) – Astro proxyt `/chat/*` dorthin.

## Struktur

```
src/
├── layouts/Layout.astro          Grundgerüst, Fonts, Anti-Flicker-Theme-Skript,
│                                 Textur-Ebene, Reveal-Skript, PWA-Registrierung
├── pages/index.astro             Landingpage (Header/Nav, Sektionen, Footer)
├── pages/chat/admin.astro        Chat-Verwaltung (Operator, noindex)
├── components/
│   ├── Hero.tsx                  Hero mit Wirbelsäulen-Illustration (statisch)
│   ├── SpineIllustration.tsx     Stilisierte Tafel „Abb. 1" (statisch)
│   ├── SpineMark.tsx             Bildmarke: drei Wirbel (statisch)
│   ├── SectionHeading.tsx        Nummerierte Abschnittsköpfe („1 – …")
│   ├── Leistungen.tsx            Leistungs-Tafeln I–III (statisch)
│   ├── Vorgehen.tsx              Ablauf als Wirbelsäule, Anamnese→Nachsorge
│   ├── Kontakt.tsx               Konsultations-/Kontakt-Sektion (statisch)
│   ├── ModeToggle.tsx            Theme-Umschalter (React-Insel, client:load)
│   ├── chat/                     Kunden-Widget, Admin-Panel, Composer, Bubbles
│   └── ui/                       shadcn-Komponenten (button, card)
├── styles/global.css             Tailwind v4, Tafel-Theme, Texturen, Animationen
├── fonts/                        Hack-woff2 (lokal)
└── lib/                          cn(), Mail-Bausteine, Chat-API, Offline-Outbox
server/                           Rust/axum: Statik + Chat-API + WS + Whisper-Client
├── migrations/                   SQLite-Schema (sqlx, ins Binary eingebettet)
└── src/                          api, auth, mail, statics, whisper, ws
e2e/                              Playwright: Login-, Text-, Bild-, Sprach- und
                                  Offline-Szenarien gegen den echten Stack
docs/chat-feature-plan.md         Architektur & Phasenplan des Chat-Features
```

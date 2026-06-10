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
- **React** als Inseln über `@astrojs/react` – nur für interaktive Teile (Theme-Toggle);
  shadcn-Komponenten werden ansonsten statisch gerendert
- **Tailwind v4** (`@tailwindcss/vite`) + **shadcn/ui** (Style „new-york", lucide)
- **Schriften lokal, kein CDN:** Fraunces (Display/Anmerkungen) und Libre Franklin
  (Fließtext/Labels) via `@fontsource-variable/*`, **Hack** als self-gehostete
  woff2 (`src/fonts/`) für Monospace
- **Dark/Light:** Inline-Skript im Layout (kein Flackern) + `ModeToggle`-Insel,
  Auswahl in `localStorage` (`fd-theme`)
- **Motion:** Hero rein per CSS-Keyframes (`anim-rise`), Scroll-Einblendungen per
  IntersectionObserver (`.reveal`, nur bei `html.js`, respektiert
  `prefers-reduced-motion`)
- **Tests:** Vitest + Testing-Library

## Build & Deployment

- **`bash build.sh`** baut das Docker-Image vollständig im Container
  (Node 22 + pnpm → Astro-Build, Tests laufen im Build mit). Laufzeit-Image:
  `static-web-server` auf scratch-Basis (`RUNTIME_FLAVOR="-alpine"` für eine
  Debug-Shell), Konfiguration in `sws.toml`. Mit `PUSH=1` wird nach
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
  Container read-only im `rp`-Netz.

## Befehle

| Befehl          | Wirkung                                        |
| :-------------- | :--------------------------------------------- |
| `pnpm dev`      | Dev-Server mit Hot-Reload (`localhost:4321`)   |
| `pnpm build`    | Statische Seite nach `./dist/` bauen           |
| `pnpm preview`  | Produktions-Build lokal ansehen                |
| `pnpm test`     | Vitest-Tests einmalig ausführen                |

## Struktur

```
src/
├── layouts/Layout.astro          Grundgerüst, Fonts, Anti-Flicker-Theme-Skript,
│                                 Textur-Ebene, Reveal-Skript
├── pages/index.astro             Landingpage (Header/Nav, Sektionen, Footer)
├── components/
│   ├── Hero.tsx                  Hero mit Wirbelsäulen-Illustration (statisch)
│   ├── SpineIllustration.tsx     Stilisierte Tafel „Abb. 1" (statisch)
│   ├── SpineMark.tsx             Bildmarke: drei Wirbel (statisch)
│   ├── SectionHeading.tsx        Nummerierte Abschnittsköpfe („1 – …")
│   ├── Leistungen.tsx            Leistungs-Tafeln I–III (statisch)
│   ├── Vorgehen.tsx              Ablauf als Wirbelsäule, Anamnese→Nachsorge
│   ├── Kontakt.tsx               Konsultations-/Kontakt-Sektion (statisch)
│   ├── ModeToggle.tsx            Theme-Umschalter (React-Insel, client:load)
│   └── ui/                       shadcn-Komponenten (button, card)
├── styles/global.css             Tailwind v4, Tafel-Theme, Texturen, Animationen
├── fonts/                        Hack-woff2 (lokal)
└── lib/utils.ts                  cn()
```

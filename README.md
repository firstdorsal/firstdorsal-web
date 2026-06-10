# firstdorsal-web

Gewerbe-Website von **firstdorsal IT-Dienstleistungen** (Paul Colin Hennig).

## Gestaltungskonzept „Anatomische Tafel"

Der Name **firstdorsal** stammt vom ersten Brustwirbel (*1st dorsal vertebra*)
einer alten anatomischen Zeichnung. Die Gestaltung greift das auf:

- **Hell** = Sepia-Papier mit Tusche, **Dunkel** = das Negativ der Tafel;
  Akzentfarbe Siena (oxidierte Tusche), Token `--sienna` / Utility `text-sienna`
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

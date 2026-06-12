# LILO 2026 — Laut in Love

Festival-Website für **Laut in Love (LILO) 2026** — umgesetzt in der
Designroute **1 „laut"** aus dem Branding-Konzept: Underground, 90er-Techno-Erbe,
raw und kinetisch. *Wir sind laut.*

## Stack

- [Astro](https://astro.build) 5 (statische Ausgabe)
- [React](https://react.dev) 19 als Insel-Komponenten (`@astrojs/react`)
- Plain CSS mit Design-Tokens (keine UI-Framework-Abhängigkeit)

## Designsystem (Route 1 „laut")

| Token | Farbe | Hex |
| --- | --- | --- |
| Industrial Anthrazit | ▓ | `#27262c` |
| Ultraviolet | ▓ | `#7947e8` |
| Majorelle Blue | ▓ | `#742df7` |
| Medium Jungle | ▓ | `#3a9a38` |
| Laser Green | ▓ | `#44f72d` |

- **Headline-Schrift:** Anton (als Ersatz für die Konzept-Schrift „Phatt")
- **Sekundär / Body:** Roboto Mono (DOS-/Schreibmaschinen-Vibe der 90er)
- **Visuelle Elemente:** animierter Thermo-Cam-Hintergrund (Canvas), Grain-Overlay,
  Grid, thermische Verläufe

## Komponenten

- `ThermalCanvas.tsx` — animierter Hitzezonen-Hintergrund (React-Insel)
- `Countdown.tsx` — Live-Countdown zum Festival (React-Insel)
- `SignupForm.tsx` — „Save the Date"-Anmeldung (React-Insel, Frontend-Demo)
- `LiloLogo.astro` — Logo (zwei ineinandergreifende Ringe) als SVG

## Entwicklung

```bash
pnpm install      # oder npm install
pnpm dev          # Dev-Server auf http://localhost:4321
pnpm build        # Produktions-Build nach ./dist
pnpm preview      # Build lokal vorschauen
```

## Hinweise

- Das Anmeldeformular ist eine reine Frontend-Demo (kein Backend angebunden).
- Festivaldatum/Countdown-Ziel: **28.–31. August 2026** (`Countdown.tsx`).
- `prefers-reduced-motion` wird respektiert (Animationen werden reduziert).

import type { CSSProperties } from 'react'

import { SectionHeading } from '@/components/SectionHeading'

// Der Ablauf als Wirbelsäule: eine vertikale Linie verbindet die nummerierten
// Schritte („Wirbel"). Die kursiven Anmerkungen greifen die medizinische
// Herkunft des Namens auf (Anamnese -> Nachsorge).
const schritte = [
  {
    anmerkung: 'Anamnese',
    titel: 'Erstkontakt',
    text: 'Unverbindlich und kostenlos: Was drückt, was soll erreicht werden, was existiert schon? Es antworten die, die es später bauen.',
  },
  {
    anmerkung: 'Diagnose',
    titel: 'Analyse & Angebot',
    text: 'Klarer Befund statt Buzzwords: Umfang, Aufwand und Preis – schriftlich, nachvollziehbar und ohne Kleingedrucktes.',
  },
  {
    anmerkung: 'Therapie',
    titel: 'Umsetzung',
    text: 'Kurze Iterationen mit jederzeit sichtbarem Stand. Quellcode, Tests und Dokumentation wachsen von Anfang an mit.',
  },
  {
    anmerkung: 'Nachsorge',
    titel: 'Übergabe & Betrieb',
    text: 'Alles gehört Ihnen: Code, Daten und Zugänge. Auf Wunsch übernehmen wir danach Betrieb, Wartung und Weiterentwicklung.',
  },
]

// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser.
export function Vorgehen() {
  return (
    <section id="vorgehen" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:py-20">
      <SectionHeading nummer="2" titel="Vorgehen" anmerkung="vom Befund zur Übergabe" />
      <ol className="relative mt-12 ml-4 space-y-12 border-l border-border pl-10 sm:ml-10">
        {schritte.map(({ anmerkung, titel, text }, i) => (
          <li
            key={titel}
            className="reveal relative max-w-2xl"
            style={{ '--reveal-delay': `${i * 110}ms` } as CSSProperties}
          >
            {/* Wirbel-Knoten auf der Linie */}
            <span
              className="absolute top-0 -left-[3.2rem] grid size-9 place-items-center rounded-md border border-brand/50 bg-card font-serif text-base italic text-brand"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="annotation text-sm">{anmerkung}</span>
            <h3 className="mt-1 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
              {titel}
            </h3>
            <p className="mt-2 text-sm/relaxed text-muted-foreground sm:text-base/relaxed">
              {text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

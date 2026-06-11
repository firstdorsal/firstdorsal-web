import type { CSSProperties } from 'react'

import type { Lang } from '@/lib/i18n'

// Deterministische Wirbelpositionen entlang einer sanften S-Kurve –
// angelehnt an die anatomische Tafel, die dem Namen zugrunde liegt.
// Der erste Wirbel (1st dorsal) ist die Anfrage: der erste Schritt, aus dem
// alles Weitere wächst – darunter hängen die Schichten der Kunden-IT.
// Wirbel 1 ist als mailto-Link klickbar und nimmt die Metapher wörtlich.
const positionen = [
  { x: 150, y: 46, r: -12, brand: true },
  { x: 162, y: 114, r: -8, brand: false },
  { x: 171, y: 182, r: -4, brand: false },
  { x: 176, y: 250, r: 0, brand: false },
  { x: 176, y: 318, r: 3, brand: false },
  { x: 171, y: 386, r: 7, brand: false },
  { x: 162, y: 454, r: 10, brand: false },
  { x: 149, y: 522, r: 13, brand: false },
]

const texte = {
  de: {
    labels: [
      'Ihre Anfrage',
      'Code',
      'Tests',
      'CI/CD',
      'Deployment',
      'Monitoring',
      'Backups',
      'Betrieb',
    ],
    aria: 'Projekt anfragen – zur Kontakt-Sektion',
    bildunterschrift: 'Abb. 1 – Die Anatomie verlässlicher IT.',
  },
  en: {
    labels: [
      'Your inquiry',
      'Code',
      'Tests',
      'CI/CD',
      'Deployment',
      'Monitoring',
      'Backups',
      'Operations',
    ],
    aria: 'Request a project – go to the contact section',
    bildunterschrift: 'Fig. 1 – The anatomy of reliable IT.',
  },
}

// Staubpunkte wie auf dem alten Filmmaterial (bewusst fest, kein Zufall).
const specks = [
  { x: 34, y: 92, r: 1.6 },
  { x: 62, y: 298, r: 1.2 },
  { x: 26, y: 472, r: 1.8 },
  { x: 330, y: 40, r: 1.3 },
  { x: 376, y: 168, r: 1.4 },
  { x: 362, y: 446, r: 1.7 },
  { x: 92, y: 540, r: 1.2 },
  { x: 372, y: 540, r: 1.4 },
  { x: 44, y: 206, r: 1.3 },
]

const serifItalic: CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontStyle: 'italic',
}

type VertebraProps = (typeof positionen)[number] & { label: string; i: number }

function Vertebra({ x, y, r, brand, i }: VertebraProps) {
  return (
    <g
      data-vertebra
      transform={`translate(${x} ${y}) rotate(${r})`}
      className={brand ? 'text-brand' : 'text-foreground/75'}
      style={{ '--i': i } as CSSProperties}
    >
      {/* Nummerierung im Stil der Tafel: „1 –" */}
      <text
        x={-88}
        y={6}
        fontSize={17}
        fill="currentColor"
        opacity={0.8}
        style={serifItalic}
      >
        {i + 1} –
      </text>
      <path d="M-62 0 H-44" stroke="currentColor" strokeWidth={1} opacity={0.35} />

      {/* Wirbelkörper mit feiner Schraffur */}
      <rect
        x={-36}
        y={-22}
        width={72}
        height={44}
        rx={10}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="var(--brand)"
        fillOpacity={brand ? 0.16 : 0.07}
      />
      <path
        d="M-26 -8 h52 M-26 0 h52 M-26 8 h52"
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.16}
      />

      {/* Gelenkfacette und Dornfortsätze */}
      <circle cx={45} cy={-13} r={5.5} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M36 -4 C 58 0, 70 10, 76 28"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d="M36 7 C 54 11, 63 18, 68 30"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.5}
      />
    </g>
  )
}

// Beschriftung wie auf einer echten Tafel – horizontal (außerhalb der
// rotierten Wirbelgruppe), erscheint synchron zum Wirbel.
function VertebraLabel({ x, y, label, brand, i }: VertebraProps) {
  return (
    <g
      data-vertebra
      className="text-brand"
      style={{ '--i': i } as CSSProperties}
    >
      <path
        d={`M${x + 84} ${y + 1} H${x + 94}`}
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.55}
      />
      <text
        x={x + 100}
        y={y + 6}
        fontSize={brand ? 18 : 15}
        fontWeight={brand ? 600 : 400}
        fill="currentColor"
        style={serifItalic}
      >
        {label}
      </text>
    </g>
  )
}

// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser; der
// mailto-Link funktioniert ohne Hydration. Nur der Link und die Bild-
// unterschrift sind für Screenreader sichtbar, der Rest ist Dekoration.
export function SpineIllustration({
  className,
  lang = 'de',
}: {
  className?: string
  lang?: Lang
}) {
  const t = texte[lang]
  const vertebrae = positionen.map((p, i) => ({ ...p, label: t.labels[i] }))
  const [erster, ...weitere] = vertebrae

  return (
    <figure className={className}>
      <svg viewBox="0 0 400 568" fill="none" className="spine-fig w-full">
        {/* Der erste Wirbel ist die Anfrage – und tatsächlich klickbar.
            Ziel ist die Kontakt-Sektion statt mailto, damit die Adresse
            nicht im statischen HTML steht (Scraper-Schutz). */}
        <a href="#kontakt" aria-label={t.aria}>
          {/* Unsichtbare Trefferfläche über dem gesamten Ensemble aus
              Nummer, Wirbel und Label – sonst ginge der Klick zwischen
              den feinen Strichen ins Leere. */}
          <rect
            x={56}
            y={10}
            width={312}
            height={72}
            fill="none"
            pointerEvents="all"
          />
          <Vertebra {...erster} i={0} />
          <VertebraLabel {...erster} i={0} />
        </a>

        <g aria-hidden="true">
          {/* Anatomische Bezeichnung des ersten Wirbels = Namensherkunft.
              Bewusst grau und klein, damit sie nicht mit dem klickbaren
              „Ihre Anfrage"-Label konkurriert. */}
          <g
            className="text-muted-foreground"
            data-vertebra
            style={{ '--i': 8 } as CSSProperties}
          >
            <text x={206} y={16} fontSize={14} fill="currentColor" style={serifItalic}>
              1st dorsal
            </text>
            <path
              d="M212 22 C 202 28, 196 36, 192 42"
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.6}
            />
          </g>

          {weitere.map((v, idx) => (
            <Vertebra key={v.label} {...v} i={idx + 1} />
          ))}
          {weitere.map((v, idx) => (
            <VertebraLabel key={v.label} {...v} i={idx + 1} />
          ))}

          {specks.map(({ x, y, r }, i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill="currentColor"
              className="text-foreground"
              opacity={0.13}
            />
          ))}
        </g>
      </svg>
      <figcaption className="annotation mt-4 text-center text-sm">
        {t.bildunterschrift}
      </figcaption>
    </figure>
  )
}

import { ArrowUpRight } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { SectionHeading } from '@/components/SectionHeading'
import type { Lang } from '@/lib/i18n'

// Referenzen als anklickbare Arbeitsproben. Der Screenshot wird wie eine
// Abbildung der anatomischen Tafel behandelt (Abb. 2, 3, ...; Abb. 1 ist
// die Wirbelsäule im Hero).
const texte = {
  de: {
    sektion: 'Referenzen',
    anmerkung: 'Arbeit, die man anklicken kann',
    abb: 'Abb.',
    projekte: [
      {
        name: 'IMPEDANZ',
        url: 'https://impedanz.net',
        urlLabel: 'impedanz.net',
        bild: '/referenzen/impedanz.webp',
        bildAlt: 'Screenshot der Website impedanz.net: Terminal-Ästhetik mit kommender Veranstaltung und Event-Archiv',
        text: 'Kompletter Webauftritt für die Veranstaltungsreihe für elektronische Musik – vom Design bis zum Betrieb.',
        punkte: [
          'Eigenständiges Design statt Template',
          'Eventseiten mit iCal-Export',
          'Self-hosted, ohne Drittanbieter, mit strikter Security-Policy',
        ],
      },
      {
        name: 'Urban Micro Gaps',
        url: 'https://samuelgrau.com/augsburg_gaps/',
        urlLabel: 'samuelgrau.com',
        bild: '/referenzen/urban-micro-gaps.webp',
        bildAlt: 'Screenshot von samuelgrau.com: Stadtkarte von Augsburg mit anklickbaren Markern der Fallstudie Urban Micro Gaps',
        text: 'Interaktive Fallstudie im Architektur-Portfolio von Samuel Grau: urbane Kleinstlücken in Augsburg, erkundbar über Karte und 3D-Viewer.',
        punkte: [
          'Interaktive Stadtkarte mit anklickbaren Fallstudien',
          '3D-Viewer direkt im Browser',
          'Teil des Portfolios für Architektur, Möbel und Visualisierung',
        ],
      },
      {
        name: 'Queer Augsburg',
        url: 'https://queer-augsburg.de/',
        urlLabel: 'queer-augsburg.de',
        bild: '/referenzen/queer-augsburg.webp',
        bildAlt: 'Screenshot von queer-augsburg.de: Veranstaltungsliste mit Terminen, Orten und Barrierefreiheits-Angaben',
        text: 'Komplette Plattform für den Verein Queer Augsburg e.V. – Website samt Backend und Mitgliederverwaltung.',
        punkte: [
          'Login- und Nutzerverwaltung',
          'Event-Redaktion direkt im Browser',
          'E-Mail-Versand an die Mitglieder',
        ],
      },
    ],
  },
  en: {
    sektion: 'References',
    anmerkung: 'work you can click on',
    abb: 'Fig.',
    projekte: [
      {
        name: 'IMPEDANZ',
        url: 'https://impedanz.net',
        urlLabel: 'impedanz.net',
        bild: '/referenzen/impedanz.webp',
        bildAlt: 'Screenshot of impedanz.net: terminal aesthetic with upcoming event and event archive',
        text: 'Complete web presence for the electronic music event series – from design to operations.',
        punkte: [
          'Distinctive design instead of a template',
          'Event pages with iCal export',
          'Self-hosted, no third parties, strict security policy',
        ],
      },
      {
        name: 'Urban Micro Gaps',
        url: 'https://samuelgrau.com/augsburg_gaps/',
        urlLabel: 'samuelgrau.com',
        bildAlt: 'Screenshot of samuelgrau.com: city map of Augsburg with clickable markers of the Urban Micro Gaps case study',
        bild: '/referenzen/urban-micro-gaps.webp',
        text: "Interactive case study in architect Samuel Grau's portfolio: urban micro gaps in Augsburg, explorable via map and 3D viewer.",
        punkte: [
          'Interactive city map with clickable case studies',
          'In-browser 3D viewer',
          'Part of a portfolio for architecture, furniture and visualisation',
        ],
      },
      {
        name: 'Queer Augsburg',
        url: 'https://queer-augsburg.de/',
        urlLabel: 'queer-augsburg.de',
        bild: '/referenzen/queer-augsburg.webp',
        bildAlt: 'Screenshot of queer-augsburg.de: event list with dates, venues and accessibility details',
        text: 'Complete platform for the non-profit Queer Augsburg e.V. – website including backend and member management.',
        punkte: [
          'Login and user management',
          'In-browser event editing',
          'Email delivery to members',
        ],
      },
    ],
  },
}

// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser.
export function Referenzen({ lang = 'de' }: { lang?: Lang }) {
  const t = texte[lang]

  return (
    <section
      id="referenzen"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:py-20"
    >
      <SectionHeading nummer="3" titel={t.sektion} anmerkung={t.anmerkung} />
      <div className="mt-10 space-y-5">
        {t.projekte.map(({ name, url, urlLabel, bild, bildAlt, text, punkte }, i) => (
          <Card
            key={name}
            className="reveal group gap-0 overflow-hidden py-0 transition-all duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_16px_44px_-24px_var(--brand)]"
          >
            <div className="grid lg:grid-cols-[minmax(0,1fr)_440px]">
              <div className="flex flex-col py-7">
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <CardTitle className="font-serif text-2xl font-semibold tracking-tight">
                      {name}
                    </CardTitle>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="label-caps inline-flex items-center gap-1 text-brand transition-colors hover:text-foreground"
                    >
                      {urlLabel}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </a>
                  </div>
                  <CardDescription className="text-sm/relaxed">
                    {text}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-4">
                  <ul className="space-y-2 text-sm text-foreground/85">
                    {punkte.map((punkt) => (
                      <li key={punkt} className="flex gap-3">
                        <span className="text-brand" aria-hidden="true">
                          –
                        </span>
                        {punkt}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </div>
              <figure className="flex flex-col border-t border-border lg:border-t-0 lg:border-l">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-0 flex-1 overflow-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <img
                    src={bild}
                    alt={bildAlt}
                    loading="lazy"
                    width="1100"
                    height="688"
                    className="h-full w-full object-cover object-top"
                  />
                </a>
                <figcaption className="annotation border-t border-border px-4 py-2 text-center text-xs">
                  {t.abb} {i + 2} – {urlLabel}
                </figcaption>
              </figure>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

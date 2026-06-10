import type { CSSProperties } from 'react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { SectionHeading } from '@/components/SectionHeading'

// Leistungen als nummerierte Tafeln eines Atlas (Tafel I–III).
const leistungen = [
  {
    tafel: 'I',
    titel: 'Software, Web & Design',
    text: 'Maßgeschneiderte Anwendungen und Web-Plattformen – individuell gestaltet, wartbar und auf Dauer betreibbar.',
    punkte: [
      'Web-Plattformen und Anwendungen',
      'Apps als Progressive Web App – eine Codebasis, alle Betriebssysteme',
      'Kreatives Webdesign – kein WordPress, keine Templates, kein Cookie-Banner',
      'APIs und Backends (Rust, TypeScript)',
      'Modernisierung bestehender Systeme',
    ],
  },
  {
    tafel: 'II',
    titel: 'IT-Forensik & Audits',
    text: 'Technische Gutachten, Sicherheits- und Code-Audits mit nachvollziehbarer Beweissicherung.',
    punkte: [
      'Technische Gutachten und Beweissicherung',
      'Code- und Sicherheits-Audits',
      'Berichte, die auch Nicht-Techniker verstehen',
    ],
  },
  {
    tafel: 'III',
    titel: 'Betrieb & Infrastruktur',
    text: 'Self-hosted, reproduzierbar und datenschutzfreundlich – vom Container bis zum Deployment.',
    punkte: [
      'Self-hosted Deployments und Container',
      'CI/CD, Monitoring und Backups',
      'Kein Vendor-Lock-in: unabhängig von US-Konzernen wie AWS, Google und Microsoft',
      'Datensparsam und DSGVO-freundlich, in der EU',
    ],
  },
]

// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser.
export function Leistungen() {
  return (
    <section id="leistungen" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:py-20">
      <SectionHeading nummer="1" titel="Leistungen" anmerkung="Tafel I–III" />
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {leistungen.map(({ tafel, titel, text, punkte }, i) => (
          <Card
            key={titel}
            className="reveal group gap-4 py-7 transition-all duration-300 hover:-translate-y-1 hover:border-sienna/60 hover:shadow-[0_16px_44px_-24px_var(--sienna)]"
            style={{ '--reveal-delay': `${i * 110}ms` } as CSSProperties}
          >
            <CardHeader className="gap-3">
              <div className="border-b border-border pb-3">
                <span className="label-caps text-muted-foreground">
                  Tafel {tafel}
                </span>
              </div>
              <CardTitle className="mt-2 font-serif text-2xl font-semibold tracking-tight">
                {titel}
              </CardTitle>
              <CardDescription className="text-sm/relaxed">
                {text}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-foreground/85">
                {punkte.map((punkt) => (
                  <li key={punkt} className="flex gap-3">
                    <span className="text-sienna" aria-hidden="true">
                      –
                    </span>
                    {punkt}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

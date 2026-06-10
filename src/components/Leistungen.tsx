import type { CSSProperties } from 'react'
import { Brain, HeartPulse, Activity, Stethoscope } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { SectionHeading } from '@/components/SectionHeading'

// Leistungen als Tafeln eines Atlas. Jede Tafel trägt ein anatomisches
// Icon als Augenzwinkern zur Tafel-Metapher: Gehirn (Entwerfen), Herz mit
// Puls („auf Herz und Nieren prüfen"), EKG-Linie (läuft und wird
// überwacht), Stethoskop (Konsultation).
const leistungen = [
  {
    icon: Brain,
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
    icon: HeartPulse,
    titel: 'IT-Forensik & Audits',
    text: 'Technische Gutachten, Sicherheits- und Code-Audits mit nachvollziehbarer Beweissicherung.',
    punkte: [
      'Technische Gutachten und Beweissicherung',
      'Code- und Sicherheits-Audits',
      'Berichte, die auch Nicht-Techniker verstehen',
    ],
  },
  {
    icon: Activity,
    titel: 'Betrieb & Infrastruktur',
    text: 'Self-hosted, reproduzierbar und datenschutzfreundlich – vom Container bis zum Deployment.',
    punkte: [
      'Self-hosted Deployments und Container',
      'CI/CD, Monitoring und Backups',
      'Kein Vendor-Lock-in: unabhängig von US-Konzernen wie AWS, Google und Microsoft',
      'Datensparsam und DSGVO-freundlich, in der EU',
    ],
  },
  {
    icon: Stethoscope,
    titel: 'IT-Beratung',
    text: 'Unabhängige Beratung rund um Web, Cloud und Betrieb – pragmatisch, herstellerneutral und auch ohne anschließendes Projekt.',
    punkte: [
      'Web-Apps, APIs und Software-Architektur',
      'Kubernetes, Container und Self-Hosting',
      'Zweite Meinung zu Angeboten, Projekten und Bestandssystemen',
    ],
  },
]

// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser.
export function Leistungen() {
  return (
    <section id="leistungen" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:py-20">
      <SectionHeading
        nummer="1"
        titel="Leistungen"
        anmerkung="Wie können wir Ihnen helfen?"
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {leistungen.map(({ icon: Icon, titel, text, punkte }, i) => (
          <Card
            key={titel}
            className="reveal group gap-4 py-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_16px_44px_-24px_var(--brand)]"
            style={{ '--reveal-delay': `${i * 110}ms` } as CSSProperties}
          >
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <CardTitle className="font-serif text-2xl font-semibold tracking-tight">
                  {titel}
                </CardTitle>
                <Icon
                  className="size-5 shrink-0 text-brand/80 transition-colors group-hover:text-brand"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
              <CardDescription className="text-sm/relaxed">
                {text}
              </CardDescription>
            </CardHeader>
            <CardContent>
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
          </Card>
        ))}
      </div>
    </section>
  )
}

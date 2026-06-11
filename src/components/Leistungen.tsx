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
import type { Lang } from '@/lib/i18n'

// Leistungen als Tafeln eines Atlas. Jede Tafel trägt ein anatomisches
// Icon als Augenzwinkern zur Tafel-Metapher: Gehirn (Entwerfen), Herz mit
// Puls („auf Herz und Nieren prüfen"), EKG-Linie (läuft und wird
// überwacht), Stethoskop (Konsultation).
const icons = [Brain, HeartPulse, Activity, Stethoscope]

const texte = {
  de: {
    sektion: 'Leistungen',
    anmerkung: 'Wie können wir Ihnen helfen?',
    tafeln: [
      {
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
        titel: 'IT-Forensik & Audits',
        text: 'Technische Gutachten, Sicherheits- und Code-Audits mit nachvollziehbarer Beweissicherung.',
        punkte: [
          'Technische Gutachten und Beweissicherung',
          'Code- und Sicherheits-Audits',
          'Berichte, die auch Nicht-Techniker verstehen',
        ],
      },
      {
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
        titel: 'IT-Beratung',
        text: 'Unabhängige Beratung rund um Web, Cloud und Betrieb – pragmatisch, herstellerneutral und auch ohne anschließendes Projekt.',
        punkte: [
          'Web-Apps, APIs und Software-Architektur',
          'Kubernetes, Container und Self-Hosting',
          'Zweite Meinung zu Angeboten, Projekten und Bestandssystemen',
        ],
      },
    ],
  },
  en: {
    sektion: 'Services',
    anmerkung: 'How can we help you?',
    tafeln: [
      {
        titel: 'Software, Web & Design',
        text: 'Tailor-made applications and web platforms – individually designed, maintainable and built to run for years.',
        punkte: [
          'Web platforms and applications',
          'Apps as Progressive Web Apps – one codebase, every operating system',
          'Creative web design – no WordPress, no templates, no cookie banner',
          'APIs and backends (Rust, TypeScript)',
          'Modernisation of existing systems',
        ],
      },
      {
        titel: 'IT Forensics & Audits',
        text: 'Technical expert reports, security and code audits with verifiable evidence preservation.',
        punkte: [
          'Expert reports and evidence preservation',
          'Code and security audits',
          'Reports that non-technical readers understand',
        ],
      },
      {
        titel: 'Operations & Infrastructure',
        text: 'Self-hosted, reproducible and privacy-friendly – from container to deployment.',
        punkte: [
          'Self-hosted deployments and containers',
          'CI/CD, monitoring and backups',
          'No vendor lock-in: independent of US corporations like AWS, Google and Microsoft',
          'Data-minimal and GDPR-friendly, hosted in the EU',
        ],
      },
      {
        titel: 'IT Consulting',
        text: 'Independent consulting on web, cloud and operations – pragmatic, vendor-neutral, with or without a follow-up project.',
        punkte: [
          'Web apps, APIs and software architecture',
          'Kubernetes, containers and self-hosting',
          'A second opinion on quotes, projects and legacy systems',
        ],
      },
    ],
  },
}

// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser.
export function Leistungen({ lang = 'de' }: { lang?: Lang }) {
  const t = texte[lang]

  return (
    <section
      id="leistungen"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:py-20"
    >
      <SectionHeading nummer="1" titel={t.sektion} anmerkung={t.anmerkung} />
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {t.tafeln.map(({ titel, text, punkte }, i) => {
          const Icon = icons[i]
          return (
            <Card
              key={titel}
              className="reveal group gap-4 py-7 transition-all duration-300 hover:border-brand/60 hover:shadow-[0_16px_44px_-24px_var(--brand)]"
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
          )
        })}
      </div>
    </section>
  )
}

import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CopyMail } from '@/components/CopyMail'
import type { Lang } from '@/lib/i18n'

const texte = {
  de: {
    anmerkung: '4 – Konsultation',
    titelVor: 'Erzählen Sie uns, wo es ',
    titelAkzent: 'weh tut',
    titelNach: '.',
    text: 'Eine kurze Mail genügt – Sie bekommen binnen 24 Stunden eine fundierte Antwort. Keine Warteschleife, kein Ticketsystem, keine Telefontermine: Alles wird schriftlich geklärt – dokumentiert, nachvollziehbar und in Ihrem Tempo.',
    fakten: 'Erstberatung kostenlos · Festpreis oder transparenter Aufwand',
    probono:
      'Für gemeinnützige Vereine setzen wir jedes Jahr ein Projekt pro bono um – fragen Sie einfach an.',
  },
  en: {
    anmerkung: '4 – Consultation',
    titelVor: 'Tell us where it ',
    titelAkzent: 'hurts',
    titelNach: '.',
    text: 'A short email is all it takes – you will get a well-founded reply within 24 hours. No hold music, no ticket system, no phone appointments: everything is handled in writing – documented, traceable and at your pace.',
    fakten: 'Free initial consultation · fixed price or transparent effort',
    probono:
      'Each year we take on one pro bono project for a non-profit – just ask.',
  },
}

// Abschluss-Sektion: eine Konsultation statt eines Kontaktformulars.
// Wegen des Kopieren-Buttons als Insel eingebunden (client:load in
// den Seiten) – React ist durch den ModeToggle ohnehin geladen.
export function Kontakt({ lang = 'de' }: { lang?: Lang }) {
  const t = texte[lang]

  return (
    <section
      id="kontakt"
      className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 sm:py-28"
    >
      <div className="reveal mx-auto max-w-3xl border-y border-border py-14 text-center sm:py-16">
        <p className="annotation text-lg">{t.anmerkung}</p>
        <h2 className="mt-5 font-serif text-4xl/[1.1] font-semibold tracking-tight text-balance sm:text-5xl/[1.08]">
          {t.titelVor}
          <em className="text-brand">{t.titelAkzent}</em>
          {t.titelNach}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base/relaxed text-muted-foreground">
          {t.text}
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className="label-caps h-11 px-7 tracking-[0.18em]"
            asChild
          >
            <a href="mailto:mail@firstdorsal.eu">
              mail@firstdorsal.eu
              <ArrowRight />
            </a>
          </Button>
          <CopyMail lang={lang} />
        </div>
        <p className="mt-8 font-mono text-xs text-muted-foreground">
          {t.fakten}
        </p>
        <p className="annotation mx-auto mt-6 max-w-md text-sm">{t.probono}</p>
      </div>
    </section>
  )
}

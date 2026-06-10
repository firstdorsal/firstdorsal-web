import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Abschluss-Sektion: eine Konsultation statt eines Kontaktformulars.
// Statisch gerendert (kein client:*-Direktiv) -> kein JS im Browser.
export function Kontakt() {
  return (
    <section id="kontakt" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 sm:py-28">
      <div className="reveal mx-auto max-w-3xl border-y border-border py-14 text-center sm:py-16">
        <p className="annotation text-lg">3 – Konsultation</p>
        <h2 className="mt-5 font-serif text-4xl/[1.1] font-semibold tracking-tight text-balance sm:text-5xl/[1.08]">
          Erzählen Sie uns, wo es <em className="text-brand">weh tut</em>.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base/relaxed text-muted-foreground">
          Eine kurze Mail genügt – Sie bekommen binnen 24&nbsp;Stunden eine
          fundierte Antwort. Keine Warteschleife, kein Ticketsystem, keine
          Telefontermine: Alles wird schriftlich geklärt – dokumentiert,
          nachvollziehbar und in Ihrem Tempo.
        </p>
        <div className="mt-9 flex justify-center">
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
        </div>
        <p className="mt-8 font-mono text-xs text-muted-foreground">
          Erstberatung kostenlos · Festpreis oder transparenter Aufwand
        </p>
      </div>
    </section>
  )
}

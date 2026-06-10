import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SpineIllustration } from '@/components/SpineIllustration'

const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties

// Statisch (kein client:*-Direktiv in index.astro) -> Astro rendert reines HTML.
// Die Einblendungen laufen rein über CSS-Keyframes (anim-rise).
export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
      <div>
        <p className="anim-rise label-caps text-brand">
          IT-Dienstleistungen · Augsburg
        </p>
        <h1
          className="anim-rise mt-6 max-w-3xl font-serif text-5xl/[1.06] font-semibold tracking-tight text-balance sm:text-7xl/[1.05] lg:text-8xl/[1.04]"
          style={delay(90)}
        >
          Das <em className="text-brand">Rückgrat</em> Ihrer IT.
        </h1>
        <p
          className="anim-rise mt-7 max-w-xl text-lg/relaxed text-muted-foreground"
          style={delay(180)}
        >
          Design, Entwicklung, Forensik und Betrieb aus einer Hand –
          pragmatisch, transparent und ohne Abhängigkeit von Dritten.
        </p>
        <div className="anim-rise mt-9 flex flex-wrap gap-3" style={delay(270)}>
          <Button
            size="lg"
            className="label-caps h-11 px-7 tracking-[0.18em]"
            asChild
          >
            <a href="mailto:mail@firstdorsal.eu">
              Projekt anfragen
              <ArrowRight />
            </a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="label-caps h-11 px-7 tracking-[0.18em]"
            asChild
          >
            <a href="#leistungen">Leistungen</a>
          </Button>
        </div>
        <p
          className="anim-rise mt-10 font-mono text-xs text-muted-foreground"
          style={delay(360)}
        >
          Antwort binnen 24&nbsp;h · feste Ansprechpartner · kurze Wege
        </p>
      </div>

      <SpineIllustration className="anim-rise hidden lg:block" />
    </section>
  )
}

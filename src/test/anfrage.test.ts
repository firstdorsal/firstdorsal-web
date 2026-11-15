// @vitest-environment node
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { loadRenderers } from 'astro:container'
import { getContainerRenderer } from '@astrojs/react'
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import Anfrage from '../pages/anfrage.astro'
import Startseite from '../pages/index.astro'
import StartseiteEn from '../pages/en/index.astro'
import Impressum from '../pages/impressum.astro'
import Datenschutz from '../pages/datenschutz.astro'

// Die Anzeigen-Landingpage nennt nur anfrage@, jede andere Seite nur mail@
// (Begründung in lib/mail.ts). Geprüft wird die gerenderte Seite.
//
// Das echte Layout braucht `Astro.site`, das der Container nicht setzen kann
// (siehe Stub). Seiten, Header, Footer und Inseln bleiben echt. Das robots-Meta
// des echten Layouts prüft scripts/pruefe-ausgabe.mjs am gebauten HTML.
vi.mock('../layouts/Layout.astro', () => import('./stubs/Layout.astro'))

type Seite = Parameters<AstroContainer['renderToString']>[0]

let container: AstroContainer

beforeAll(async () => {
  const renderers = await loadRenderers([getContainerRenderer()])
  container = await AstroContainer.create({ renderers })
})

const rendere = async (seite: Seite, pfad: string) => {
  const html = await container.renderToString(seite, {
    request: new Request(`https://firstdorsal.eu${pfad}`),
  })
  return new JSDOM(html).window.document
}

const mailtoZiele = (dokument: Document) =>
  [...dokument.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')].map(
    (a) => a.getAttribute('href'),
  )

// Props der React-Inseln, wie Astro sie serialisiert: { name: [Typ, Wert] }.
const inselPostfaecher = (dokument: Document) =>
  [...dokument.querySelectorAll('astro-island')].flatMap((insel) => {
    const props = JSON.parse(insel.getAttribute('props') ?? '{}') as Record<string, [number, unknown]>
    return props.postfach ? [props.postfach[1]] : []
  })

const interneLinks = (dokument: Document) =>
  [...dokument.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/') || href.startsWith('#'))

describe('Anzeigen-Landingpage /anfrage', () => {
  it('nennt ausschließlich die anfrage-Adresse', async () => {
    const dokument = await rendere(Anfrage, '/anfrage')
    expect(mailtoZiele(dokument)).toEqual(['mailto:anfrage@firstdorsal.eu'])
    expect(dokument.body.textContent).toContain('anfrage@firstdorsal.eu')
    expect(dokument.body.textContent).not.toMatch(/\bmail@firstdorsal\.eu/)
  })

  it('übergibt der Kontakt-Insel das anfrage-Postfach', async () => {
    expect(inselPostfaecher(await rendere(Anfrage, '/anfrage'))).toEqual(['anfrage'])
  })

  // Jeder Link, der die Seite verlässt, führt zu einer Seite mit mail@. Die
  // Liste ist bewusst festgeschrieben: Impressum und Datenschutz müssen
  // erreichbar bleiben, alles andere bleibt auf der Seite.
  it('verlässt die Seite nur in Richtung der Rechtstexte', async () => {
    const ziele = new Set(interneLinks(await rendere(Anfrage, '/anfrage')))
    expect([...ziele].sort()).toEqual(
      ['#kontakt', '#leistungen', '/anfrage', '/datenschutz', '/impressum'].sort(),
    )
  })

  it('beschriftet den Logo-Link passend zu seinem Ziel', async () => {
    const dokument = await rendere(Anfrage, '/anfrage')
    const logo = dokument.querySelector('header a[href="/anfrage"]')
    expect(logo?.getAttribute('aria-label')).toBe('firstdorsal Creative Technology – zum Seitenanfang')
  })

  it('reicht noindex an das Layout durch', async () => {
    const dokument = await rendere(Anfrage, '/anfrage')
    expect(dokument.documentElement.dataset.noindex).toBe('true')
  })
})

describe.each([
  { name: 'Startseite /', seite: Startseite, pfad: '/' },
  { name: 'englische Startseite /en/', seite: StartseiteEn, pfad: '/en/' },
  { name: 'Impressum', seite: Impressum, pfad: '/impressum/' },
  { name: 'Datenschutz', seite: Datenschutz, pfad: '/datenschutz/' },
])('$name', ({ seite, pfad }) => {
  it('nennt nur die mail-Adresse, nie anfrage@', async () => {
    const dokument = await rendere(seite, pfad)
    expect(new Set(mailtoZiele(dokument))).toEqual(new Set(['mailto:mail@firstdorsal.eu']))
    expect(dokument.documentElement.outerHTML).not.toContain('anfrage@')
    expect(inselPostfaecher(dokument)).not.toContain('anfrage')
  })

  it('bleibt im Suchindex', async () => {
    expect((await rendere(seite, pfad)).documentElement.dataset.noindex).toBe('false')
  })
})

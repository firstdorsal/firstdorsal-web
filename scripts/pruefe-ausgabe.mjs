// Prüft das gebaute HTML in dist/ – läuft im Image-Build nach `pnpm build`
// (Dockerfile). Die Seitentests rendern mit einem Layout-Stub; hier wird das
// echte Ergebnis geprüft:
//   1. Genau die Seiten aus NICHT_INDEXIEREN tragen das robots-Meta `noindex`.
//   2. Die Sitemap listet genau die übrigen Seiten.
//   3. anfrage@ steht nur auf der Anzeigen-Landingpage, mail@ nie dort
//      (Begründung in src/lib/mail.ts).
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { JSDOM } from 'jsdom'

import { ANZEIGEN_PFAD, NICHT_INDEXIEREN, istIndexierbar } from '../src/lib/indexierung.mjs'

const DIST = new URL('../dist/', import.meta.url).pathname
const fehler = []

function htmlDateien(verzeichnis) {
  return readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag.name)
    if (eintrag.isDirectory()) return htmlDateien(pfad)
    return eintrag.name.endsWith('.html') ? [pfad] : []
  })
}

// dist/index.html -> '/', dist/impressum/index.html -> '/impressum'
const routeVon = (datei) => {
  const teile = relative(DIST, datei).split(sep)
  teile.pop()
  return `/${teile.join('/')}`
}

const seiten = htmlDateien(DIST).map((datei) => {
  const dokument = new JSDOM(readFileSync(datei, 'utf8')).window.document
  const inselPostfaecher = [...dokument.querySelectorAll('astro-island')].flatMap((insel) => {
    const props = JSON.parse(insel.getAttribute('props') ?? '{}')
    return props.postfach ? [props.postfach[1]] : []
  })
  return {
    route: routeVon(datei),
    robots: dokument.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    mailto: [...dokument.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href')),
    text: dokument.body.textContent ?? '',
    inselPostfaecher,
  }
})

if (seiten.length === 0) fehler.push('dist/ enthält keine HTML-Seite – lief `pnpm build`?')

// 1. robots-Meta
const mitNoindex = seiten.filter((s) => s.robots?.includes('noindex')).map((s) => s.route).sort()
const erwartet = [...NICHT_INDEXIEREN].sort()
if (JSON.stringify(mitNoindex) !== JSON.stringify(erwartet)) {
  fehler.push(`noindex-Seiten ${JSON.stringify(mitNoindex)}, erwartet ${JSON.stringify(erwartet)}`)
}

// 2. Sitemap
const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')
const gelistet = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => new URL(m[1]).pathname.replace(/\/+$/, '') || '/')
  .sort()
const indexierbar = seiten
  .map((s) => s.route)
  .filter((route) => istIndexierbar(`https://firstdorsal.eu${route}`))
  .sort()
if (JSON.stringify(gelistet) !== JSON.stringify(indexierbar)) {
  fehler.push(`Sitemap listet ${JSON.stringify(gelistet)}, erwartet ${JSON.stringify(indexierbar)}`)
}

// 3. Postfächer
for (const seite of seiten) {
  const aufLandingpage = seite.route === ANZEIGEN_PFAD
  const eigene = aufLandingpage ? 'anfrage' : 'mail'
  const fremde = aufLandingpage ? /\bmail@firstdorsal\.eu/ : /anfrage@firstdorsal\.eu/
  const fremdeMailtos = seite.mailto.filter((href) => href !== `mailto:${eigene}@firstdorsal.eu`)
  if (fremdeMailtos.length > 0) fehler.push(`${seite.route}: fremde mailto-Ziele ${fremdeMailtos.join(', ')}`)
  if (fremde.test(seite.text)) fehler.push(`${seite.route}: nennt die Adresse des anderen Postfachs`)
  const fremdeInseln = seite.inselPostfaecher.filter((postfach) => postfach !== eigene)
  if (fremdeInseln.length > 0) fehler.push(`${seite.route}: Insel mit Postfach ${fremdeInseln.join(', ')}`)
}
const landingpage = seiten.find((s) => s.route === ANZEIGEN_PFAD)
if (!landingpage) fehler.push(`${ANZEIGEN_PFAD} fehlt im Build`)
else if (!landingpage.mailto.includes('mailto:anfrage@firstdorsal.eu')) {
  fehler.push(`${ANZEIGEN_PFAD}: kein mailto auf anfrage@`)
}

if (fehler.length > 0) {
  console.error(`pruefe-ausgabe: ${fehler.length} Fehler\n- ${fehler.join('\n- ')}`)
  process.exit(1)
}
console.log(`pruefe-ausgabe: ok (${seiten.length} Seiten, noindex: ${mitNoindex.join(', ')})`)

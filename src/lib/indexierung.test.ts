import { describe, expect, it } from 'vitest'

import { ANZEIGEN_PFAD, NICHT_INDEXIEREN, istIndexierbar } from './indexierung.mjs'

describe('istIndexierbar (Sitemap-Filter)', () => {
  it('hält die Anzeigen-Landingpage aus der Sitemap, mit und ohne Schrägstrich', () => {
    expect(NICHT_INDEXIEREN).toContain(ANZEIGEN_PFAD)
    expect(istIndexierbar('https://firstdorsal.eu/anfrage/')).toBe(false)
    expect(istIndexierbar('https://firstdorsal.eu/anfrage')).toBe(false)
  })

  it('lässt alle übrigen Seiten in der Sitemap', () => {
    for (const pfad of ['/', '/en/', '/impressum/', '/datenschutz/']) {
      expect(istIndexierbar(`https://firstdorsal.eu${pfad}`), pfad).toBe(true)
    }
  })

  it('vergleicht den Pfad exakt statt als Teilzeichenkette', () => {
    expect(istIndexierbar('https://firstdorsal.eu/anfragen/')).toBe(true)
    expect(istIndexierbar('https://firstdorsal.eu/anfrage-danke/')).toBe(true)
    expect(istIndexierbar('https://firstdorsal.eu/en/anfrage/')).toBe(true)
  })
})

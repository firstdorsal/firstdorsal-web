import { expect, test, type Page } from '@playwright/test'

import { kundeAnmelden, neueKundenMail } from './helpers'

// Performance des Chat-Verlaufs unter Last: Eine Konversation wird über
// den Test-Seed mit vielen Nachrichten gefüllt (Text, Bilder, Videos im
// Wechsel). Geprüft wird die Kernzusage der Virtualisierung – egal wie
// lang der Verlauf ist, bleibt die Zahl der gerenderten DOM-Knoten klein
// (sonst würden tausende Bild-/Video-Elemente den Browser lahmlegen) –
// und dass das endlose Nachladen älterer Nachrichten flüssig bleibt.

const TOTAL = 1500
// Sichtbares Fenster + Überhang; deutlich unter der Gesamtzahl.
const MAX_RENDERED = 80

async function renderedRows(page: Page): Promise<number> {
  return page.locator('[data-testid="msg-row"]').count()
}

async function loadedCount(page: Page): Promise<number> {
  const v = await page.getByTestId('message-scroll').getAttribute('data-loaded')
  return Number(v ?? 0)
}

test('Virtual Scrolling: großer Verlauf bleibt schlank und lädt flüssig nach', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const email = neueKundenMail('perf')

  // Verlauf vorbefüllen (Text/Bild/Video im Wechsel).
  const seed = await request.post('/chat/api/test/seed', {
    data: { email, count: TOTAL },
  })
  expect(seed.ok()).toBeTruthy()

  // Erstes Laden: nur das jüngste Fenster kommt über die Leitung.
  const startLogin = Date.now()
  await kundeAnmelden(page, email)
  await expect(page.getByTestId('message-scroll')).toBeVisible()
  // Jüngste Textnachricht (Nr. 1497, größtes Vielfaches von 3 unter 1500).
  await expect(
    page.getByText(`Seed-Nachricht Nummer ${TOTAL - 3}`, { exact: false }),
  ).toBeVisible()
  const ladezeit = Date.now() - startLogin

  // Trotz 1500 Nachrichten nur ein kleines Fenster im DOM.
  expect(await renderedRows(page)).toBeLessThan(MAX_RENDERED)

  // Endlos nach oben scrollen: mehrere Seiten älterer Nachrichten laden.
  const scroll = page.getByTestId('message-scroll')
  const startScroll = Date.now()
  for (let i = 0; i < 8; i++) {
    const vorher = await loadedCount(page)
    await scroll.evaluate((el) => {
      el.scrollTop = 0
    })
    // Warten, bis weitere ältere Nachrichten geladen wurden.
    await expect.poll(() => loadedCount(page)).toBeGreaterThan(vorher)
    // DOM bleibt zu jedem Zeitpunkt beschränkt – das ist die Kernzusage.
    expect(await renderedRows(page)).toBeLessThan(MAX_RENDERED)
  }
  const scrollzeit = Date.now() - startScroll

  // Es wurden tatsächlich viele weitere Seiten geladen …
  expect(await loadedCount(page)).toBeGreaterThan(8 * 25)
  // … das DOM ist aber weiterhin winzig im Vergleich zu 1500 Nachrichten.
  expect(await renderedRows(page)).toBeLessThan(MAX_RENDERED)
  // … und das Ganze blieb flott (großzügiges Budget gegen Flakiness).
  expect(ladezeit).toBeLessThan(20_000)
  expect(scrollzeit).toBeLessThan(40_000)
})

import { expect, test, type Browser } from '@playwright/test'

import { ADMIN_STATE, kundeAnmelden, neueKundenMail } from './helpers'

// Echter WebRTC-Anruf zwischen Kunde und Operator über zwei Browser-
// Kontexte. Chromium nutzt Fake-Kamera/-Mikrofon (Flags in der
// playwright.config). Ohne STUN/TURN reicht auf einer Maschine der
// Loopback-/Host-Kandidat – die Verbindung kommt direkt zustande.

async function adminMitKonversation(browser: Browser, email: string) {
  const context = await browser.newContext({ storageState: ADMIN_STATE })
  const page = await context.newPage()
  await page.goto('/chat/admin/')
  await expect(page.getByText('Chat-Verwaltung')).toBeVisible()
  await page.getByRole('button', { name: new RegExp(email) }).click()
  return { context, page }
}

test('Videoanruf wird aufgebaut (Operator ruft, Kunde nimmt an)', async ({ page, browser }) => {
  const email = neueKundenMail('call')
  await kundeAnmelden(page, email)
  // Eine Nachricht, damit die Konversation in der Admin-Liste oben steht.
  await page.getByLabel('Nachricht schreiben …').fill('Können wir kurz telefonieren?')
  await page.getByRole('button', { name: 'Nachricht senden' }).click()

  const { context, page: admin } = await adminMitKonversation(browser, email)

  // Operator startet den Videoanruf …
  await admin.getByRole('button', { name: 'Videoanruf starten' }).click()
  // … beim Kunden klingelt es, er nimmt mit Video an.
  await page.getByRole('button', { name: 'Mit Video annehmen' }).click()

  // Beide Seiten erreichen den Zustand „connected" – der Medienpfad steht.
  await expect(page.getByTestId('call-panel')).toHaveAttribute('data-call-state', 'connected', {
    timeout: 30_000,
  })
  await expect(admin.getByTestId('call-panel')).toHaveAttribute('data-call-state', 'connected', {
    timeout: 30_000,
  })

  // Die Gegenstelle liefert tatsächlich ein Videobild (Frames > 0).
  await expect
    .poll(
      () =>
        admin
          .getByTestId('remote-video')
          .evaluate((v: HTMLVideoElement) => v.videoWidth),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)

  // Auflegen beendet den Anruf auf beiden Seiten.
  await admin.getByRole('button', { name: 'Auflegen' }).click()
  await expect(page.getByTestId('call-panel')).toBeHidden({ timeout: 10_000 })
  await context.close()
})

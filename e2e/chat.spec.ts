import path from 'node:path'

import { expect, test, type Browser } from '@playwright/test'

import { ADMIN_STATE, kundeAnmelden, neueKundenMail } from './helpers'

const TESTBILD = path.join(import.meta.dirname, 'fixtures/testbild.png')
// Die Sprachprobe (fixtures/sprachprobe.wav) sagt: "Hallo, ich
// interessiere mich für eine neue Website für meine Firma." – das
// tiny-Modell muss davon zumindest die Kernbegriffe treffen.
const TRANSKRIPT_MUSTER = /website|firma|interessiere/i

// Operator-Sicht in eigenem Browser-Kontext (Session aus dem Setup-Projekt).
async function adminSeite(browser: Browser) {
  const context = await browser.newContext({ storageState: ADMIN_STATE })
  const page = await context.newPage()
  await page.goto('/chat/admin/')
  await expect(page.getByText('Chat-Verwaltung')).toBeVisible()
  return { context, page }
}

test('Text-Chat: Kunde schreibt, Operator antwortet live', async ({ page, browser }) => {
  const email = neueKundenMail('text')
  await kundeAnmelden(page, email)

  await page.getByLabel('Nachricht schreiben …').fill('Hallo, ich brauche Hilfe mit meiner Website.')
  await page.getByRole('button', { name: 'Nachricht senden' }).click()
  await expect(page.getByText('Hallo, ich brauche Hilfe mit meiner Website.')).toBeVisible()

  const { context, page: admin } = await adminSeite(browser)
  await admin.getByRole('button', { name: new RegExp(email) }).click()
  // getByText träfe auch die Listen-Vorschau – gezielt den Nachrichten-Absatz prüfen.
  await expect(
    admin.getByRole('paragraph').filter({ hasText: 'Hallo, ich brauche Hilfe mit meiner Website.' }),
  ).toBeVisible()

  await admin.getByLabel('Nachricht schreiben …').fill('Gern – was genau klemmt?')
  await admin.getByRole('button', { name: 'Nachricht senden' }).click()
  // Die Antwort erreicht den Kunden live über den WebSocket – kein Reload.
  await expect(page.getByText('Gern – was genau klemmt?')).toBeVisible()
  await context.close()
})

test('Bildnachricht kommt beim Operator an', async ({ page, browser }) => {
  const email = neueKundenMail('bild')
  await kundeAnmelden(page, email)

  await page.locator('input[type=file]').setInputFiles(TESTBILD)
  await expect(page.locator('img[alt="Gesendetes Bild"]')).toBeVisible()

  const { context, page: admin } = await adminSeite(browser)
  await admin.getByRole('button', { name: new RegExp(email) }).click()
  await expect(admin.locator('img[alt="Gesendetes Bild"]')).toBeVisible()
  await context.close()
})

test('Sprachnachricht wird aufgenommen und echt transkribiert', async ({ page, browser }) => {
  // Beim allerersten Lauf lädt der Whisper-Dienst noch sein Modell.
  test.setTimeout(300_000)
  const email = neueKundenMail('voice')
  await kundeAnmelden(page, email)

  // Das Fake-Mikrofon spielt die echte Sprachprobe ein (~5,3 s) – lange
  // genug aufnehmen, damit der ganze Satz drin ist.
  await page.getByRole('button', { name: 'Sprachnachricht aufnehmen' }).click()
  await page.waitForTimeout(6_500)
  await page.getByRole('button', { name: 'Aufnahme beenden und senden' }).click()

  await expect(page.locator('audio')).toBeVisible()
  // Echte faster-whisper-Transkription, nachgereicht per WebSocket.
  await expect(page.getByTestId('transcript')).toHaveText(TRANSKRIPT_MUSTER, {
    timeout: 240_000,
  })

  const { context, page: admin } = await adminSeite(browser)
  await admin.getByRole('button', { name: new RegExp(email) }).click()
  await expect(admin.locator('audio')).toBeVisible()
  await expect(admin.getByTestId('transcript')).toHaveText(TRANSKRIPT_MUSTER)
  await context.close()
})

test('Offline: Nachrichten und Medien warten in der Outbox und werden nachgereicht', async ({
  page,
  browser,
  context,
}) => {
  const email = neueKundenMail('offline')
  await kundeAnmelden(page, email)

  await context.setOffline(true)
  await page.getByLabel('Nachricht schreiben …').fill('Offline geschrieben')
  await page.getByRole('button', { name: 'Nachricht senden' }).click()
  await expect(page.getByText('wartet auf Versand …')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(TESTBILD)
  await expect(page.getByText('wartet auf Versand …')).toHaveCount(2)

  // Wieder online: Die Outbox wird automatisch geleert …
  await context.setOffline(false)
  await expect(page.getByText('wartet auf Versand …')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText('Offline geschrieben')).toBeVisible()

  // … und alles ist beim Operator angekommen.
  const { context: adminCtx, page: admin } = await adminSeite(browser)
  await admin.getByRole('button', { name: new RegExp(email) }).click()
  await expect(
    admin.getByRole('paragraph').filter({ hasText: 'Offline geschrieben' }),
  ).toBeVisible()
  await expect(admin.locator('img[alt="Gesendetes Bild"]')).toBeVisible()
  await adminCtx.close()
})

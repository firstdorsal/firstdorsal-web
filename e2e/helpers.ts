import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, type Page } from '@playwright/test'

export const MAIL_DIR = path.join(import.meta.dirname, '.tmp/mails')
export const OPERATOR_EMAIL = 'operator@firstdorsal.eu'
/** Vom Setup-Projekt (auth.setup.ts) abgelegte Operator-Session. */
export const ADMIN_STATE = path.join(import.meta.dirname, '.tmp/admin-state.json')

/** Magic-Link aus der jüngsten Mail-Datei an diese Adresse fischen. */
export async function magicLinkFor(email: string): Promise<string> {
  const marker = email.replace(/[@/]/g, '_')
  for (let versuch = 0; versuch < 40; versuch++) {
    const dateien = (await readdir(MAIL_DIR).catch(() => []))
      .filter((f) => f.includes(marker))
      .sort()
    const letzte = dateien.at(-1)
    if (letzte) {
      const inhalt = await readFile(path.join(MAIL_DIR, letzte), 'utf8')
      const link = inhalt.match(/http:\/\/localhost:8788\/chat\/login\?token=[\w-]+/)?.[0]
      if (link) return link
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`keine Magic-Link-Mail für ${email} gefunden`)
}

/** Kompletter Kunden-Login über das Widget (E-Mail → Magic-Link → Chat). */
export async function kundeAnmelden(page: Page, email: string): Promise<void> {
  await page.goto('/')
  // Der Launcher steht schon im statischen HTML, reagiert aber erst nach
  // der React-Hydration (client:idle) – deshalb Klick mit Wiederholung.
  await expect(async () => {
    await page.getByRole('button', { name: 'Chat öffnen' }).click({ timeout: 2_000 })
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1_500 })
  }).toPass()
  await page.getByLabel('Ihre E-Mail-Adresse').fill(email)
  await page.getByRole('button', { name: 'Anmeldelink senden' }).click()
  await expect(page.getByText(/Anmeldelink geschickt/)).toBeVisible()
  await page.goto(await magicLinkFor(email))
  // ?chat=open öffnet das Widget; die Eingabezeile zeigt den Chat-Zustand an.
  await expect(page.getByLabel('Nachricht schreiben …')).toBeVisible()
}

/** Eindeutige Kundenadresse je Test (umgeht das Rate-Limit pro Adresse). */
export function neueKundenMail(name: string): string {
  return `${name}-${Date.now()}@example.org`
}

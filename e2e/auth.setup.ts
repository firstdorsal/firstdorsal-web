import { expect, test as setup } from '@playwright/test'

import { ADMIN_STATE, magicLinkFor, OPERATOR_EMAIL } from './helpers'

// Der Operator meldet sich genau einmal an; die Tests laden den
// storageState, statt je Test einen Magic-Link anzufordern (Rate-Limit).
setup('Operator anmelden', async ({ page }) => {
  await page.goto('/chat/admin/')
  await page.getByLabel('Operator-E-Mail').fill(OPERATOR_EMAIL)
  await page.getByRole('button', { name: 'Anmeldelink senden' }).click()
  await expect(page.getByText(/Anmeldelink verschickt/)).toBeVisible()
  await page.goto(await magicLinkFor(OPERATOR_EMAIL))
  await expect(page.getByText('Chat-Verwaltung')).toBeVisible()
  await page.context().storageState({ path: ADMIN_STATE })
})

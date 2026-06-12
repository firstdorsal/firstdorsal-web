import { defineConfig, devices } from '@playwright/test'

// E2E-Tests gegen den echten Rust-Server (liefert dist/ aus wie in
// Produktion). Mails landen als Dateien in e2e/.tmp/mails (MAIL_FILE_DIR),
// die Transkription beantwortet ein Mock-Whisper (e2e/mock-whisper.mjs).
// Ein Worker, da die Tests eine gemeinsame SQLite-DB teilen.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  // Der Server wird je Lauf frisch gestartet (leere DB, leerer Mail-Ordner).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'retain-on-failure',
  },
  projects: [
    // Einmal-Anmeldung des Operators; die Tests nutzen den storageState
    // (vermeidet das Magic-Link-Rate-Limit pro Adresse).
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // Fake-Mikrofon für die Sprachnachrichten-Tests.
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-whisper.mjs',
      port: 8799,
      reuseExistingServer: true,
    },
    {
      command: 'bash e2e/start-server.sh',
      port: 8788,
      reuseExistingServer: false,
      // Astro-Build + cargo-Build können beim ersten Lauf dauern.
      timeout: 600_000,
    },
  ],
})

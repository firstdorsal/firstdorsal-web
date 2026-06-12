import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

// E2E-Tests gegen den echten Stack: Rust-Server (liefert dist/ aus wie in
// Produktion) und das ECHTE whisper-asr-webservice im Docker-Container
// (Produktions-Image, tiny-Modell). Mails landen als Dateien in
// e2e/.tmp/mails (MAIL_FILE_DIR). Die Sprachnachricht kommt aus einem
// echten Sprach-Fixture, das Chromium als Fake-Mikrofon einspielt.
// Ein Worker, da die Tests eine gemeinsame SQLite-DB teilen.
// Voraussetzung: Docker (für Whisper).
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
        // Fake-Mikrofon, das die echte Sprachprobe abspielt – die
        // Aufnahme im MediaRecorder enthält damit echte Sprache.
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-audio-capture=${path.join(
              import.meta.dirname,
              'e2e/fixtures/sprachprobe.wav',
            )}`,
          ],
        },
      },
    },
  ],
  webServer: [
    {
      // Erster Lauf zieht Image + Modell – danach aus dem Cache-Volume.
      command: 'bash e2e/start-whisper.sh',
      port: 8799,
      reuseExistingServer: true,
      timeout: 600_000,
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

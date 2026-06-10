/// <reference types="vitest" />
import { getViteConfig } from 'astro/config'

// getViteConfig übernimmt Astros Vite-Setup (React-Plugin, @-Alias) für die Tests.
export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})

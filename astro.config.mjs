// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath, URL } from 'node:url';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import { istIndexierbar } from './src/lib/indexierung.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://firstdorsal.eu',
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
  },
  integrations: [
    react(),
    sitemap({ filter: istIndexierbar }),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});

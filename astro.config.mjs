// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath, URL } from 'node:url';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://firstdorsal.eu',
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
  },
  integrations: [
    react(),
    // Die Chat-Verwaltung ist nicht für Suchmaschinen gedacht.
    sitemap({ filter: (page) => !page.includes('/chat/admin') }),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Im Dev-Modus läuft das Chat-Backend separat (cargo run in server/,
      // lauscht auf 8080); Astro proxyt die dynamischen Pfade dorthin –
      // Same-Origin wie später im Container.
      proxy: {
        '/chat/api': 'http://localhost:8080',
        '/chat/login': 'http://localhost:8080',
        '/chat/ws': { target: 'http://localhost:8080', ws: true },
      },
    },
  },
});

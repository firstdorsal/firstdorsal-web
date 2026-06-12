// Service Worker der PWA: macht die Seite installierbar und offline
// nutzbar. Bewusst handgeschrieben statt Workbox – die Strategie ist
// klein genug:
//   - /chat/* (API, WebSocket, Login) wird NIE angefasst; die
//     Offline-Outbox des Chats lebt in IndexedDB (src/lib/offline.ts).
//   - Gehashte Assets (/_astro/) und Icons: cache-first, die Namen
//     ändern sich bei jeder Änderung.
//   - Seiten (Navigationen): network-first mit Cache-Fallback, damit
//     Deploys sofort sichtbar sind, die Seite aber offline lädt.
// Bei Strategieänderungen VERSION hochzählen – alte Caches werden beim
// activate aufgeräumt.
const VERSION = 'fd-v1'
const SHELL = ['/', '/en/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/chat/')) return // Chat macht sein Offline-Handling selbst

  // Gehashte Assets & statische Bilder: cache-first.
  if (
    url.pathname.startsWith('/_astro/') ||
    /\.(png|svg|ico|woff2)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // Seiten: network-first, offline aus dem Cache (Fallback Startseite).
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        try {
          const res = await fetch(req)
          if (res.ok) cache.put(req, res.clone())
          return res
        } catch {
          return (await cache.match(req)) ?? (await cache.match('/')) ?? Response.error()
        }
      }),
    )
  }
})

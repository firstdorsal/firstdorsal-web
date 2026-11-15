// Welche Seiten in den Suchindex dürfen. Plain JavaScript statt TypeScript,
// weil astro.config.mjs dieses Modul direkt importiert.

/** Ziel-URL der Google-Anzeigen (Begründung in lib/mail.ts). */
export const ANZEIGEN_PFAD = '/anfrage'

/**
 * Pfade, die per Meta-Tag `noindex` tragen. Sie dürfen nicht in die Sitemap:
 * Eine Seite, die zur Indexierung eingereicht und zugleich per Meta-Tag
 * verboten wird, meldet die Search Console dauerhaft als Fehler. Den Abgleich
 * mit dem gebauten HTML prüft scripts/pruefe-ausgabe.mjs im Image-Build.
 */
export const NICHT_INDEXIEREN = [ANZEIGEN_PFAD]

/**
 * Sitemap-Filter: vergleicht den Pfad exakt, damit etwa `/anfragen` nicht
 * versehentlich mit herausfällt.
 * @param {string} url absolute URL einer Seite
 * @returns {boolean}
 */
export function istIndexierbar(url) {
  const pfad = new URL(url).pathname.replace(/\/+$/, '') || '/'
  return !NICHT_INDEXIEREN.includes(pfad)
}

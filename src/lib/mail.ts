// Spam-Scraper-Schutz: Die Mail-Adresse wird erst zur Laufzeit aus
// Bausteinen zusammengesetzt, damit sie nirgends zusammenhängend im
// ausgelieferten Quelltext steht (weder im HTML noch im JS-Bundle).
// Naive Harvester, die HTML/JS nur mit Regex absuchen, finden so nichts.
const DOMAIN = ['firstdorsal', 'eu'].join('.')

// Postfächer der Seite. `anfrage` steht ausschließlich auf der
// Anzeigen-Landingpage (lib/indexierung.mjs, ANZEIGEN_PFAD): Mails an diese
// Adresse zählen als Anzeigen-Leads. So lässt sich der Erfolg der
// Google-Anzeigen messen, ohne Pixel, Cookie oder Google-Tag und damit ohne
// Einwilligungsbanner nach § 25 TDDDG. Es ist eine Näherung: Wer von der
// Landingpage ins Impressum oder in die Datenschutzerklärung wechselt, sieht
// dort mail@ (beide Seiten müssen erreichbar bleiben), und wer /anfrage direkt
// aufruft, zählt mit.
//
// Beide Adressen landen im selben Postfach: firstdorsal.eu hat auf dem
// Mailserver ein Catch-all (per SMTP-RCPT-Probe am 2026-11-09 geprüft). Fällt
// das Catch-all je weg, muss anfrage@ als Alias angelegt werden, sonst gehen
// die Anzeigen-Leads verloren.
export type Postfach = 'mail' | 'anfrage'

export function mailAdresse(postfach: Postfach): string {
  return [postfach, DOMAIN].join('@')
}

export function mailtoHref(postfach: Postfach): string {
  return `mailto:${mailAdresse(postfach)}`
}

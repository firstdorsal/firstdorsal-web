// Spam-Scraper-Schutz: Die Mail-Adresse wird erst zur Laufzeit aus
// Bausteinen zusammengesetzt, damit sie nirgends zusammenhängend im
// ausgelieferten Quelltext steht (weder im HTML noch im JS-Bundle).
// Naive Harvester, die HTML/JS nur mit Regex absuchen, finden so nichts.
const NUTZER = 'mail'
const DOMAIN = ['firstdorsal', 'eu'].join('.')

export function mailAdresse(): string {
  return [NUTZER, DOMAIN].join('@')
}

export function mailtoHref(): string {
  return `mailto:${mailAdresse()}`
}

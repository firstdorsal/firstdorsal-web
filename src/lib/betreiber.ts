// Stammdaten des Betreibers – die eine Quelle für Impressum, Datenschutz,
// Fußzeile, Seitentitel und strukturierte Daten. Ein Umzug oder eine neue
// Geschäftsbezeichnung ist damit eine Änderung an genau dieser Stelle.
export const BETREIBER = {
  name: 'firstdorsal Creative Technology',
  inhaber: 'Paul Colin Hennig',
  strasse: 'Mundingstraße 2',
  plz: '86159',
  ort: 'Augsburg',
  land: 'DE',
} as const

export const postanschrift = {
  '@type': 'PostalAddress',
  streetAddress: BETREIBER.strasse,
  postalCode: BETREIBER.plz,
  addressLocality: BETREIBER.ort,
  addressCountry: BETREIBER.land,
} as const

// Abschnittsüberschrift im Tafel-Stil: nummerierter „Wirbel" („1 –"),
// Serifen-Titel und optionale kursive Anmerkung am rechten Rand.
export function SectionHeading({
  nummer,
  titel,
  anmerkung,
}: {
  nummer: string
  titel: string
  anmerkung?: string
}) {
  return (
    <div className="reveal flex items-end justify-between gap-6 border-b border-border pb-4">
      <div className="flex items-baseline gap-4">
        <span className="annotation text-xl" aria-hidden="true">
          {nummer} –
        </span>
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {titel}
        </h2>
      </div>
      {anmerkung && (
        <span className="annotation hidden text-sm sm:block">{anmerkung}</span>
      )}
    </div>
  )
}

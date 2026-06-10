// Bildmarke: drei stilisierte Wirbelkörper mit Dornfortsätzen – ein kurzes
// Stück Wirbelsäule (Namensherkunft „1st dorsal"). Statisch gerendert,
// Farben über currentColor, damit die Marke Theme und Kontext folgt.
export function SpineMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="7" y="2.5" width="13" height="6.5" rx="2.4" />
        <rect x="9.5" y="12.75" width="13" height="6.5" rx="2.4" />
        <rect x="7" y="23" width="13" height="6.5" rx="2.4" />
        <path d="M20.5 5.75h5" />
        <path d="M23 16h5" />
        <path d="M20.5 26.25h5" />
      </g>
    </svg>
  )
}

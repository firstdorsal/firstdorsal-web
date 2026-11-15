import '@testing-library/jest-dom/vitest'

// Die Browser-Stubs nur in jsdom. Seitentests, die Astro-Seiten über den
// Container-API rendern, laufen in der node-Umgebung (`@vitest-environment
// node`): esbuild verweigert unter jsdom den Start, und dort gibt es kein
// `window`.
if (typeof window !== 'undefined') {
  // jsdom implementiert window.matchMedia nicht – als Vorsichtsmaßnahme stubben.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia
  }
}

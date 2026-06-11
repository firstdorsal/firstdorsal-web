import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Kontakt } from './Kontakt'

describe('Kontakt', () => {
  it('zeigt die Konsultations-Überschrift', () => {
    render(<Kontakt />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /Erzählen Sie uns, wo es\s*weh tut\s*\./,
    )
  })

  it('baut den mailto-Link erst clientseitig zusammen (Scraper-Schutz)', async () => {
    render(<Kontakt />)
    // Nach der Hydration zeigt der Button die Adresse und den mailto-Link.
    expect(
      await screen.findByRole('link', { name: /mail@firstdorsal\.eu/i }),
    ).toHaveAttribute('href', 'mailto:mail@firstdorsal.eu')
  })

  it('erwähnt das Pro-bono-Angebot für Vereine', () => {
    render(<Kontakt />)
    expect(
      screen.getByText(/gemeinnützige Vereine.*pro bono/),
    ).toBeInTheDocument()
  })

  it('rendert auf Englisch mit übersetzter Überschrift', () => {
    render(<Kontakt lang="en" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /Tell us where it\s*hurts\s*\./,
    )
    expect(
      screen.getByRole('button', { name: /Copy email address/i }),
    ).toBeInTheDocument()
  })
})

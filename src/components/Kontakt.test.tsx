import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Kontakt } from './Kontakt'

describe('Kontakt', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  it('zeigt die Konsultations-Überschrift', () => {
    render(<Kontakt postfach="mail" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /Erzählen Sie uns, wo es\s*weh tut\s*\./,
    )
  })

  it('baut den mailto-Link erst clientseitig zusammen (Scraper-Schutz)', async () => {
    render(<Kontakt postfach="mail" />)
    // Nach der Hydration zeigt der Button die Adresse und den mailto-Link.
    expect(
      await screen.findByRole('link', { name: /mail@firstdorsal\.eu/i }),
    ).toHaveAttribute('href', 'mailto:mail@firstdorsal.eu')
  })

  // Anzeigen-Landingpage: lib/mail.ts.
  it('zeigt auf der Anzeigen-Landingpage die anfrage-Adresse', async () => {
    render(<Kontakt postfach="anfrage" />)
    expect(
      await screen.findByRole('link', { name: /anfrage@firstdorsal\.eu/i }),
    ).toHaveAttribute('href', 'mailto:anfrage@firstdorsal.eu')
    expect(screen.queryByText(/mail@firstdorsal\.eu/)).toBeNull()
  })

  it.each(['mail', 'anfrage'] as const)(
    'reicht das Postfach %s an den Kopieren-Knopf weiter',
    async (postfach) => {
      render(<Kontakt postfach={postfach} />)
      await userEvent.click(screen.getByRole('button', { name: /E-Mail-Adresse kopieren/i }))
      expect(writeText).toHaveBeenCalledWith(`${postfach}@firstdorsal.eu`)
    },
  )

  it('erwähnt das Pro-bono-Angebot für Vereine', () => {
    render(<Kontakt postfach="mail" />)
    expect(
      screen.getByText(/gemeinnützige Vereine.*pro bono/),
    ).toBeInTheDocument()
  })

  it('rendert auf Englisch mit übersetzter Überschrift', () => {
    render(<Kontakt lang="en" postfach="mail" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      /Tell us where it\s*hurts\s*\./,
    )
    expect(
      screen.getByRole('button', { name: /Copy email address/i }),
    ).toBeInTheDocument()
  })
})

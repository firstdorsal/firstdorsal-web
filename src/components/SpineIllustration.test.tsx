import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { SpineIllustration } from './SpineIllustration'

describe('SpineIllustration', () => {
  it('beschriftet Wirbel 1 als Anfrage und den Rest mit den IT-Schichten', () => {
    render(<SpineIllustration />)
    for (const label of [
      'Ihre Anfrage',
      'Code',
      'Tests',
      'CI/CD',
      'Deployment',
      'Monitoring',
      'Backups',
      'Betrieb',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('trägt die Namensherkunft „1st dorsal" und die Bildunterschrift', () => {
    render(<SpineIllustration />)
    expect(screen.getByText('1st dorsal')).toBeInTheDocument()
    expect(
      screen.getByText(/Abb\. 1 – Die Anatomie verlässlicher IT\./),
    ).toBeInTheDocument()
  })

  it('macht den ersten Wirbel als Link zur Kontakt-Sektion klickbar', () => {
    render(<SpineIllustration />)
    // Bewusst #kontakt statt mailto (Scraper-Schutz).
    const link = screen.getByLabelText('Projekt anfragen – zur Kontakt-Sektion')
    expect(link).toHaveAttribute('href', '#kontakt')
  })

  it('deckt den ganzen Bereich von Wirbel 1 mit einer Trefferfläche ab', () => {
    render(<SpineIllustration />)
    const link = screen.getByLabelText('Projekt anfragen – zur Kontakt-Sektion')
    const hitArea = link.querySelector('rect[pointer-events="all"]')
    expect(hitArea).not.toBeNull()
    // Fläche muss Nummer (ab x≈65) bis Label-Ende (x≈360) überspannen.
    const x = Number(hitArea!.getAttribute('x'))
    const width = Number(hitArea!.getAttribute('width'))
    expect(x).toBeLessThanOrEqual(65)
    expect(x + width).toBeGreaterThanOrEqual(360)
  })
})

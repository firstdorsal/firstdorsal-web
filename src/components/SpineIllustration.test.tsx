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

  it('macht den ersten Wirbel als mailto-Link klickbar', () => {
    render(<SpineIllustration />)
    const link = screen.getByLabelText('Projekt anfragen – mail@firstdorsal.eu')
    expect(link).toHaveAttribute('href', 'mailto:mail@firstdorsal.eu')
  })
})

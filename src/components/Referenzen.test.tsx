import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Referenzen } from './Referenzen'

describe('Referenzen', () => {
  it('zeigt IMPEDANZ mit Link und Arbeitsprobe', () => {
    render(<Referenzen />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Referenzen' }),
    ).toBeInTheDocument()
    expect(screen.getByText('IMPEDANZ')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link).toHaveAttribute('href', 'https://impedanz.net')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/referenzen/impedanz.webp',
    )
  })

  it('rendert auf Englisch', () => {
    render(<Referenzen lang="en" />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'References' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Distinctive design instead of a template'),
    ).toBeInTheDocument()
  })
})

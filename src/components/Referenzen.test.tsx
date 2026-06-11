import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Referenzen } from './Referenzen'

describe('Referenzen', () => {
  it('zeigt IMPEDANZ und Urban Micro Gaps mit Links und Arbeitsproben', () => {
    render(<Referenzen />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Referenzen' }),
    ).toBeInTheDocument()
    expect(screen.getByText('IMPEDANZ')).toBeInTheDocument()
    expect(screen.getByText('Urban Micro Gaps')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /impedanz\.net/i }),
    ).toHaveAttribute('href', 'https://impedanz.net')
    expect(
      screen.getByRole('link', { name: /samuelgrau\.com/i }),
    ).toHaveAttribute('href', 'https://samuelgrau.com/augsburg_gaps/')
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
    // Die Screenshots liegen bewusst in aria-hidden-Links (der Textlink
    // darüber ist der zugängliche) – daher hidden: true.
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(2)
  })

  it('rendert auf Englisch', () => {
    render(<Referenzen lang="en" />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'References' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Distinctive design instead of a template'),
    ).toBeInTheDocument()
    expect(screen.getByText('In-browser 3D viewer')).toBeInTheDocument()
  })
})

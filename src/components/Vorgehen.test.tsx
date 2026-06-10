import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Vorgehen } from './Vorgehen'

describe('Vorgehen', () => {
  it('führt die vier Schritte in Reihenfolge auf', () => {
    render(<Vorgehen />)
    const schritte = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(schritte).toEqual([
      'Erstkontakt',
      'Analyse & Angebot',
      'Umsetzung',
      'Übergabe & Betrieb',
    ])
  })

  it('trägt die medizinischen Anmerkungen der Tafel-Metapher', () => {
    render(<Vorgehen />)
    for (const anmerkung of ['Anamnese', 'Diagnose', 'Therapie', 'Nachsorge']) {
      expect(screen.getByText(anmerkung)).toBeInTheDocument()
    }
  })

  it('rendert auf Englisch mit übersetzten Schritten', () => {
    render(<Vorgehen lang="en" />)
    const schritte = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(schritte).toEqual([
      'First contact',
      'Analysis & quote',
      'Implementation',
      'Handover & operations',
    ])
  })
})

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Hero } from './Hero'

describe('Hero', () => {
  it('zeigt die Hauptüberschrift mit dem Kernversprechen', () => {
    render(<Hero />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/Das\s*Rückgrat\s*Ihrer IT\./)
  })

  it('verlinkt die Anfrage zur Kontakt-Sektion und die Leistungen', () => {
    render(<Hero />)
    // CTA-Button und klickbarer erster Wirbel der Illustration. Beide
    // zeigen bewusst auf #kontakt statt mailto (Scraper-Schutz).
    const anfrageLinks = screen.getAllByRole('link', {
      name: /Projekt anfragen/i,
    })
    expect(anfrageLinks).toHaveLength(2)
    for (const link of anfrageLinks) {
      expect(link).toHaveAttribute('href', '#kontakt')
    }
    expect(screen.getByRole('link', { name: /Leistungen/i })).toHaveAttribute(
      'href',
      '#leistungen',
    )
  })

  it('nennt Standort und Reaktionszeit', () => {
    render(<Hero />)
    expect(
      screen.getByText('IT-Dienstleistungen · Augsburg'),
    ).toBeInTheDocument()
    expect(screen.getByText(/binnen 24\s*h/)).toBeInTheDocument()
  })

  it('rendert auf Englisch mit übersetzter Überschrift und Labels', () => {
    render(<Hero lang="en" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /The\s*backbone\s*of your IT\./,
    )
    expect(
      screen.getAllByRole('link', { name: /Request a project/i }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Your inquiry')).toBeInTheDocument()
  })
})

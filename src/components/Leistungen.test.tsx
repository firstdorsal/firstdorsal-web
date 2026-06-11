import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'

import { Leistungen } from './Leistungen'
import { ModeToggle } from './ModeToggle'

describe('Leistungen', () => {
  it('listet die sechs Leistungen mit ihren Titeln', () => {
    render(<Leistungen />)
    expect(screen.getByText('Web & Design')).toBeInTheDocument()
    expect(screen.getByText('Backends, APIs & Plattformen')).toBeInTheDocument()
    expect(screen.getByText('IT-Forensik & Audits')).toBeInTheDocument()
    expect(screen.getByText('Betrieb & Infrastruktur')).toBeInTheDocument()
    expect(screen.getByText('IT-Beratung')).toBeInTheDocument()
    expect(screen.getByText('UX & Usability-Testing')).toBeInTheDocument()
    expect(screen.queryByText(/Tafel I/)).not.toBeInTheDocument()
  })

  it('nennt konkrete Leistungspunkte', () => {
    render(<Leistungen />)
    expect(
      screen.getByText('APIs und Backends (Rust, TypeScript)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Moderne Web-Apps mit Astro, React, TypeScript und Tailwind'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Web-Plattformen mit Login und Nutzerverwaltung'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Kreatives Webdesign – kein WordPress, keine Templates, keine unnötigen Cookie-Banner',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Apps als Progressive Web App – eine Codebasis, alle Betriebssysteme',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Datensparsam und DSGVO-freundlich, in der EU'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Kubernetes, Container und Betrieb auf eigener Infrastruktur'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Zweite Meinung zu Angeboten, Projekten und Bestandssystemen'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Technische Gutachten und Beweissicherung'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('CI/CD, Monitoring und Backups'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('UX- und UI-Tests: Bedienbarkeit auf dem Prüfstand'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('User-Journey-Prüfungen: kommen Ihre Nutzer ans Ziel?'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Kein Vendor-Lock-in: unabhängig von US-Konzernen wie AWS, Google und Microsoft',
      ),
    ).toBeInTheDocument()
  })

  it('trägt die Abschnittsüberschrift „Leistungen"', () => {
    render(<Leistungen />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Leistungen' }),
    ).toBeInTheDocument()
  })

  it('rendert auf Englisch mit übersetzten Tafeln', () => {
    render(<Leistungen lang="en" />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Services' }),
    ).toBeInTheDocument()
    expect(screen.getByText('IT Forensics & Audits')).toBeInTheDocument()
    expect(screen.getByText('Backends, APIs & Platforms')).toBeInTheDocument()
    expect(screen.getByText('UX & Usability Testing')).toBeInTheDocument()
    expect(
      screen.getByText(
        'User journey reviews: do your users reach their goal?',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'No vendor lock-in: independent of US corporations like AWS, Google and Microsoft',
      ),
    ).toBeInTheDocument()
  })
})

describe('ModeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('schaltet die dark-Klasse um und merkt sie sich', async () => {
    render(<ModeToggle />)
    const btn = screen.getByRole('button', { name: /Hell\/Dunkel umschalten/i })
    await userEvent.click(btn)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('fd-theme')).toBe('dark')
    await userEvent.click(btn)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('fd-theme')).toBe('light')
  })
})

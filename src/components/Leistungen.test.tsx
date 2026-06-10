import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'

import { Leistungen } from './Leistungen'
import { ModeToggle } from './ModeToggle'

describe('Leistungen', () => {
  it('listet die drei Leistungen als Tafeln I–III', () => {
    render(<Leistungen />)
    expect(screen.getByText('Software, Web & Design')).toBeInTheDocument()
    expect(screen.getByText('IT-Forensik & Audits')).toBeInTheDocument()
    expect(screen.getByText('Betrieb & Infrastruktur')).toBeInTheDocument()
    expect(screen.getByText('Tafel I')).toBeInTheDocument()
    expect(screen.getByText('Tafel II')).toBeInTheDocument()
    expect(screen.getByText('Tafel III')).toBeInTheDocument()
  })

  it('nennt konkrete Leistungspunkte', () => {
    render(<Leistungen />)
    expect(
      screen.getByText('APIs und Backends (Rust, TypeScript)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Kreatives Webdesign – kein WordPress, keine Templates, kein Cookie-Banner',
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
      screen.getByText('Technische Gutachten und Beweissicherung'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('CI/CD, Monitoring und Backups'),
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

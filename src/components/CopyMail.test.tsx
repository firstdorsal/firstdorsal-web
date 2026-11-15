import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { CopyMail } from './CopyMail'

describe('CopyMail', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  it('kopiert die Adresse in die Zwischenablage und bestätigt', async () => {
    render(<CopyMail postfach="mail" />)
    // aria-Label bewusst ohne Adresse (Scraper-Schutz).
    const btn = screen.getByRole('button', {
      name: /E-Mail-Adresse kopieren/i,
    })
    await userEvent.click(btn)
    expect(writeText).toHaveBeenCalledWith('mail@firstdorsal.eu')
    expect(btn).toHaveTextContent('Adresse kopiert')
  })

  it('kopiert auf der Anzeigen-Landingpage die anfrage-Adresse', async () => {
    render(<CopyMail postfach="anfrage" />)
    await userEvent.click(
      screen.getByRole('button', { name: /E-Mail-Adresse kopieren/i }),
    )
    expect(writeText).toHaveBeenCalledWith('anfrage@firstdorsal.eu')
  })

  it('zeigt vor dem Klick die Kopieren-Beschriftung', () => {
    render(<CopyMail postfach="mail" />)
    expect(screen.getByRole('button')).toHaveTextContent('Adresse kopieren')
  })
})

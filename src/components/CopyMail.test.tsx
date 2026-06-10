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
    render(<CopyMail />)
    const btn = screen.getByRole('button', {
      name: /E-Mail-Adresse mail@firstdorsal\.eu kopieren/i,
    })
    await userEvent.click(btn)
    expect(writeText).toHaveBeenCalledWith('mail@firstdorsal.eu')
    expect(btn).toHaveTextContent('Adresse kopiert')
  })

  it('zeigt vor dem Klick die Kopieren-Beschriftung', () => {
    render(<CopyMail />)
    expect(screen.getByRole('button')).toHaveTextContent('Adresse kopieren')
  })
})

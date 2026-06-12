import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatWidget } from './ChatWidget'

// fetch-Stub: /chat/api/me → 401 (nicht angemeldet), Magic-Link-Anfrage
// je nach Test ok oder Rate-Limit.
function stubFetch(requestStatus = 200) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/chat/api/me')) return new Response(null, { status: 401 })
    if (url.endsWith('/chat/api/auth/request')) {
      expect(init?.method).toBe('POST')
      return new Response(JSON.stringify({ ok: requestStatus === 200 }), {
        status: requestStatus,
      })
    }
    throw new Error(`unerwarteter fetch: ${url}`)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChatWidget', () => {
  it('zeigt zu Beginn nur den Launcher', () => {
    stubFetch()
    render(<ChatWidget lang="de" />)
    expect(screen.getByRole('button', { name: 'Chat öffnen' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('öffnet das Panel und fragt ohne Session nach der E-Mail', async () => {
    stubFetch()
    const user = userEvent.setup()
    render(<ChatWidget lang="de" />)

    await user.click(screen.getByRole('button', { name: 'Chat öffnen' }))
    expect(await screen.findByLabelText('Ihre E-Mail-Adresse')).toBeInTheDocument()
    // Einwilligungshinweis mit Link auf die Datenschutzerklärung.
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute(
      'href',
      '/datenschutz',
    )
  })

  it('fordert den Magic-Link an und bestätigt den Versand', async () => {
    const mock = stubFetch()
    const user = userEvent.setup()
    render(<ChatWidget lang="de" />)

    await user.click(screen.getByRole('button', { name: 'Chat öffnen' }))
    await user.type(await screen.findByLabelText('Ihre E-Mail-Adresse'), 'kunde@example.org')
    await user.click(screen.getByRole('button', { name: 'Anmeldelink senden' }))

    expect(await screen.findByText(/Anmeldelink geschickt/)).toBeInTheDocument()
    const anfrage = mock.mock.calls.find(([url]) =>
      String(url).endsWith('/chat/api/auth/request'),
    )
    expect(anfrage?.[1]?.body).toBe(
      JSON.stringify({ email: 'kunde@example.org', lang: 'de' }),
    )
  })

  it('meldet das Rate-Limit verständlich', async () => {
    stubFetch(429)
    const user = userEvent.setup()
    render(<ChatWidget lang="en" />)

    await user.click(screen.getByRole('button', { name: 'Open chat' }))
    await user.type(await screen.findByLabelText('Your email address'), 'kunde@example.org')
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }))

    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument()
  })
})

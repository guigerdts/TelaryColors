// AppRouter — verifies the /muestras route and its mobile-first registration
// page are reachable from the shared layout's navigation (design ADR: nav link).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import App from '../App.jsx'
import { setToken } from '../auth/store.js'

const COLORS = [{ id: 1, code: '221 C', gamut: 'C', paint_type: 'reactiva' }]

describe('AppRouter /muestras route', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setToken('jwt-routing')
    fetchMock.mockClear()
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, status: 200, json: async () => COLORS }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders a Muestras nav link in the shared layout', () => {
    render(<App />)

    // The authenticated layout renders the top navigation.
    const link = screen.getByRole('link', { name: /muestras/i })
    expect(link).toHaveAttribute('href', '/muestras')
  })

  it('navigating to /muestras renders the mobile-first registration page', async () => {
    render(<App />)

    await act(async () => {})
    fireEvent.click(screen.getByRole('link', { name: /muestras/i }))
    await act(async () => {})

    // The registration page's heading + its primary action are on the route.
    expect(screen.getByRole('heading', { name: /registrar muestra/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /registrar muestra/i })).toBeTruthy()
  })
})

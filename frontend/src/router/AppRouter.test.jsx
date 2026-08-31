// AppRouter — verifies the /muestras, /inventario and /inventario/alertas
// routes and their pages are reachable from the shared layout's navigation
// (design ADR: nav link).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import App from '../App.jsx'
import { setToken } from '../auth/store.js'

const COLORS = [{ id: 1, code: '221 C', gamut: 'C', paint_type: 'reactiva' }]

describe('AppRouter guarded routes', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    setToken('jwt-routing')
    fetchMock.mockClear()
    fetchMock.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('/inventory/items') || u.includes('/inventory/reorder-alerts')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => COLORS })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders a Muestras nav link in the shared layout', () => {
    render(<App />)

    // The authenticated layout renders the top navigation.
    const link = screen.getAllByRole('link', { name: /muestras/i })[0]
    expect(link).toHaveAttribute('href', '/muestras')
  })

  it('navigating to /muestras renders the mobile-first registration page', async () => {
    render(<App />)

    await act(async () => {})
    fireEvent.click(screen.getAllByRole('link', { name: /muestras/i })[0])
    await act(async () => {})

    // The registration page's heading + its primary action are on the route.
    expect(screen.getByRole('heading', { name: /registrar muestra/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /registrar muestra/i })).toBeTruthy()
  })

  it('renders an Inventario nav link in the shared layout', () => {
    render(<App />)

    // The authenticated layout renders the top navigation.
    const link = screen.getAllByRole('link', { name: /inventario/i })[0]
    expect(link).toHaveAttribute('href', '/inventario')
  })

  it('navigating to /inventario renders the inventory list page', async () => {
    render(<App />)

    await act(async () => {})
    fireEvent.click(screen.getAllByRole('link', { name: /inventario/i })[0])
    await act(async () => {})

    // The inventory page's heading + its create action are on the route.
    expect(screen.getByRole('heading', { name: /inventario/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /crear item/i })).toBeTruthy()
  })

  it('renders an Alertas nav link in the shared layout', () => {
    render(<App />)

    // The authenticated layout renders the top navigation.
    const link = screen.getAllByRole('link', { name: /alertas/i })[0]
    expect(link).toHaveAttribute('href', '/inventario/alertas')
  })

  it('navigating to /inventario/alertas renders the reorder alerts page', async () => {
    render(<App />)

    await act(async () => {})
    fireEvent.click(screen.getAllByRole('link', { name: /alertas/i })[0])
    await act(async () => {})

    // The alerts page's heading is on the route.
    expect(screen.getByRole('heading', { name: /alertas de reposición/i })).toBeTruthy()
  })
})

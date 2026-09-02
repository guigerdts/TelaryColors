// AppRouter — verifies the /muestras, /inventario and /inventario/alertas
// routes and their pages are reachable from the shared layout's navigation
// (design ADR: nav link).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import App from '../App.jsx'
import { setToken } from '../auth/store.js'

const COLORS = [{ id: 1, code: '221', gamut: 'C', paint_type: 'reactiva' }]
const FORMULAS = [{ id: 7, name: 'Fórmula 221', pantone_color_id: 1 }]
const DETAIL = {
  id: 7,
  name: 'Fórmula 221',
  pantone_color_id: 1,
  ingredients: [{ id: 1, colorant: 'Blanco', quantity_g: '820.0' }],
  designs: [],
}

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
      if (u.includes('/samples')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      if (u.includes('/formulas') && u.includes('/detail')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => DETAIL })
      }
      if (u.includes('/formulas')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => FORMULAS })
      }
      if (u.includes('/designs')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => COLORS })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    // Restore the URL after tests that pushState a deep-link route.
    window.history.pushState({}, '', '/')
  })

  it('renders a Muestras nav link pointing at the browse list, not the form', () => {
    render(<App />)

    // The authenticated layout renders the top navigation. The Muestras
    // destination browses existing samples; the create form lives under it.
    const link = screen.getAllByRole('link', { name: /muestras/i })[0]
    expect(link).toHaveAttribute('href', '/muestras/lista')
  })

  it('navigating to the Muestras nav renders the list page with a Nueva muestra action', async () => {
    render(<App />)

    await act(async () => {})
    fireEvent.click(screen.getAllByRole('link', { name: /muestras/i })[0])
    await act(async () => {})

    // The browse list page is lazy-loaded, so it resolves async — findBy
    // waits for the chunk.
    expect(
      await screen.findByRole('heading', { name: /muestras/i }, { timeout: 5000 })
    ).toBeTruthy()
    expect(await screen.findByText(/no hay muestras/i, {}, { timeout: 5000 })).toBeTruthy()
    // …and offers the create form via its "Nueva muestra" button.
    expect(screen.getByRole('link', { name: /nueva muestra/i })).toHaveAttribute('href', '/muestras')
  })

  it('deep-linking to /muestras still renders the mobile-first registration form', async () => {
    // Regression: the create form stays at /muestras (the list page links to
    // it) — it must not fall through to the wildcard /search redirect.
    window.history.pushState({}, '', '/muestras')
    render(<App />)
    await act(async () => {})

    expect(
      await screen.findByRole('heading', { name: /registrar muestra/i }, { timeout: 5000 })
    ).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: /registrar muestra/i }, { timeout: 5000 })
    ).toBeTruthy()
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
    // The empty-state heading also contains "inventario", so use getAllByRole.
    expect(screen.getAllByRole('heading', { name: /inventario/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /crear item/i }).length).toBeGreaterThanOrEqual(1)
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

    // The alerts page is lazy-loaded — findBy waits for the chunk.
    expect(
      await screen.findByRole('heading', { name: /alertas de reposición/i }, { timeout: 5000 })
    ).toBeTruthy()
  })

  it('navigating to /inventario/transaccion?formula_id=X renders the transaction form, not a redirect to /search', async () => {
    // Regression: the "Registrar consumo" NavLink from a formula points here with
    // ?formula_id= (spec "Happy-path consumo with formula"). Before wiring the
    // route, any unregistered path fell through to the wildcard -> /search, so
    // the primary consumption workflow was unreachable. Now it must render the
    // form (P0 regression).
    window.history.pushState({}, '', '/inventario/transaccion?formula_id=7')
    render(<App />)
    await act(async () => {})

    // The transaction form is on the route — NOT redirected to /search. It is
    // lazy-loaded, so findBy waits for the chunk.
    expect(
      await screen.findByRole('heading', { name: /registrar transacción/i }, { timeout: 5000 })
    ).toBeTruthy()
    // The ?formula_id= prefill marks the formula as read-only with its hint.
    expect(
      await screen.findByText(/fórmula prefijada desde la ficha/i, {}, { timeout: 5000 })
    ).toBeTruthy()
  })

  it('deep-links to /pantone/:id and renders the self-loading ficha', async () => {
    // Regression: PantoneCard links to /pantone/{id} (Punto 2) — the route must
    // exist and resolve to the PantoneDetail ficha, not fall through to /search.
    window.history.pushState({}, '', '/pantone/1')
    render(<App />)
    await act(async () => {})

    // The formula ingredient renders — proving the detail ficha is on the route.
    // The section heading is "{detail.name} — Ingredientes" (e.g. "Fórmula 221 — Ingredientes").
    expect(screen.getByRole('region', { name: /— ingredientes/i })).toBeTruthy()
  })
})

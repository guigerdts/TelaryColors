// PantoneDetail — the extended ficha (Slice E). Consumes the rich formula
// detail endpoint GET /formulas/{id}/detail in a SINGLE call (design D3 /
// user confirmation: formula + deduplicated linked designs come from one
// response — no separate requests for formula and designs). Handles loading,
// error (404/fetch-fail) and empty (no designs) states.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'

import PantoneDetail from '../pages/PantoneDetail.jsx'

const PANTONE = { code: '211', gamut: 'C', hex: '#E63950' }

const DETAIL = {
  id: 7,
  name: 'Fórmula coral 211',
  pantone_color_id: 3,
  ingredients: [
    { id: 1, colorant: 'Blanco', quantity_g: '820.0' },
    { id: 2, colorant: 'Rojo rubí', quantity_g: '130.0' },
  ],
  designs: [
    { id: 11, name: 'Linterna Coral', client: 'Telary Home', notes: null },
    { id: 12, name: 'Vasija Fuego', client: null, notes: null },
  ],
}

const okJson = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body })

describe('PantoneDetail (single-call ficha)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads formula + deduplicated designs from ONE call to /formulas/{id}/detail', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/api/v1/formulas/7/detail')) return okJson(DETAIL)
      return okJson([])
    })

    render(<PantoneDetail formulaId={7} pantone={PANTONE} />)
    await act(async () => {})

    // Exactly one request hits the detail endpoint (confirmation user 3).
    const detailCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/v1/formulas/7/detail'),
    )
    expect(detailCalls.length).toBe(1)
    expect(String(detailCalls[0][0])).toContain('/api/v1/formulas/7/detail')

    // Formula + designs rendered from that single response.
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
    const designsSection = screen.getByRole('region', {
      name: 'Diseños que usan esta fórmula',
    })
    expect(within(designsSection).getByText('Linterna Coral')).toBeTruthy()
  })

  it('shows a loading state while fetching', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    render(<PantoneDetail formulaId={7} pantone={PANTONE} />)
    expect(screen.getByText(/Cargando/)).toBeTruthy()
  })

  it('shows an error (404 / fetch failure) and recovers', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({ detail: 'Fórmula no encontrada' }) }),
    )

    const { unmount } = render(<PantoneDetail formulaId={999} pantone={PANTONE} />)
    await act(async () => {})
    expect(screen.getByText(/Fórmula no encontrada/)).toBeTruthy()

    // A later successful fetch recovers from the error state.
    fetchMock.mockImplementation(() => okJson(DETAIL))
    await act(async () => {
      screen.getByRole('button', { name: /Reintentar/i }).click()
    })
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
  })

  it('renders an empty designs section when the detail returns no designs', async () => {
    fetchMock.mockImplementation(() => okJson({ ...DETAIL, designs: [] }))
    render(<PantoneDetail formulaId={7} pantone={PANTONE} />)
    await act(async () => {})

    const designsSection = screen.getByRole('region', {
      name: 'Diseños que usan esta fórmula',
    })
    expect(within(designsSection).getByText(/Sin diseños vinculados/)).toBeTruthy()
    // Formula still renders from the same response.
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
  })
})

// PantoneDetail — the extended ficha (Slice E). Consumes the rich formula
// detail endpoint GET /formulas/{id}/detail in a SINGLE call (design D3 /
// user confirmation: formula + deduplicated linked designs come from one
// response — no separate requests for formula and designs). Handles loading,
// error (404/fetch-fail) and empty (no designs) states.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

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

  it('manually links an EXISTING design (listDesigns) — never inline creation', async () => {
    const DESIGNS = [
      { id: 21, name: 'Linterna Coral', client: 'Telary Home', notes: null },
      { id: 22, name: 'Maceta Norte', client: null, notes: null },
    ]
    fetchMock.mockImplementation((url, init) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.includes('/formulas/7/detail') && method === 'GET') return okJson(DETAIL)
      if (u.includes('/designs') && method === 'GET') return okJson(DESIGNS)
      if (u.includes('/formulas/7/designs') && method === 'POST') {
        return okJson({ id: 99, formula_id: 7, design_id: 21, source: 'manual' })
      }
      return okJson([])
    })

    render(<PantoneDetail formulaId={7} pantone={PANTONE} />)
    await act(async () => {})

    // The manual-link selector offers ONLY the existing designs from listDesigns.
    const selector = screen.getByLabelText(/vincular diseño/i)
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Linterna Coral',
      'Maceta Norte',
    ])

    fireEvent.change(selector, { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: /vincular/i }))
    await act(async () => {})

    // Links via linkDesignToFormula — POST /formulas/{id}/designs with design_id.
    const linkCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/formulas/7/designs'),
    )
    expect(linkCall).toBeTruthy()
    expect(JSON.parse(linkCall[1].body).design_id).toBe(21)

    // No inline creation is ever attempted (creation lives in the /designs
    // collection POST) — the only /designs POST is the link to the formula
    // sub-resource above, never a create on the collection root.
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        init?.method === 'POST' &&
        String(url).match(/\/api\/v1\/designs(\?|$)/),
    )
    expect(createCall).toBeUndefined()
  })
})

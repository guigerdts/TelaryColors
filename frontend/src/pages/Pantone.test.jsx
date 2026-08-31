// Pantone page (Slice F) — the color catalog renders every pantone as a
// PantoneCard (not the legacy Fase 1 table), the gamut selector offers the
// real options C/TPX/U as a validated <select> (never free text), and the
// delete action still works from the card listing (pantone-card spec
// "Gamut Selector").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import PantonePage from './Pantone.jsx'

const COLORS = [
  { id: 1, code: '211', gamut: 'C', paint_type: 'reactiva' },
  { id: 2, code: '2210', gamut: 'TPX', paint_type: 'pigmento' },
]

const okJson = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body })

describe('PantonePage (Slice F: card catalog + gamut selector)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
      if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
      return okJson([])
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders every pantone as a PantoneCard (wordmark + PMS code+gamut), never the legacy table', async () => {
    render(<PantonePage />)
    await act(async () => {})

    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('PANTONE®')).toBeTruthy()
    expect(screen.getByText('PMS 211 C')).toBeTruthy()
    expect(screen.getByText('PMS 2210 TPX')).toBeTruthy()
    // The Fase 1 table is gone.
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('still lets an operator delete a color from the card listing', async () => {
    render(<PantonePage />)
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'eliminar 211' }))
    await act(async () => {})

    const del = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'DELETE' && String(url).includes('/pantone-colors/1'),
    )
    expect(del).toBeTruthy()
    // The card for the deleted color disappears from the listing.
    expect(screen.queryByText('PMS 211 C')).toBeNull()
  })

  it('offers the real gamuts C/TPX/U as select options, never free text', async () => {
    render(<PantonePage />)
    await act(async () => {})

    const gamut = screen.getByLabelText(/gamut/i)
    expect(gamut.tagName).toBe('SELECT')
    const options = within(gamut).getAllByRole('option').map((o) => o.value)
    // Only the real gamuts are selectable — an out-of-range value cannot even
    // be expressed in the UI (pantone-card spec: only the real options allowed).
    expect(options).toEqual(['C', 'TPX', 'U'])
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SearchPage from './Search.jsx'

const renderPage = () => render(<MemoryRouter><SearchPage /></MemoryRouter>)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Slice F: the search results render as PantoneCards, so code and gamut are
// separate (codigo/gamut) and the card renders "PMS 221 C" with the PANTONE®
// wordmark — not the legacy flat box with raw "221 C".
const COLORS = [
  { id: 1, code: '221', gamut: 'C', paint_type: 'reactiva' },
  { id: 2, code: '2210', gamut: 'C', paint_type: 'pigmento' },
]

const FORMULAS = [{ id: 10, pantone_color_id: 1, name: 'Fórmula 221', ingredients: [] }]

// Routed fetch mock so the page's search, formulas, and batch sample
// requests each get the data they need.
function buildMock(colors, formulas, samplesByColor) {
  return vi.fn((url) => {
    const u = String(url)
    if (u.includes('/samples?pantone_target_ids=')) {
      const ids = new URL(u, 'http://localhost')
        .searchParams.get('pantone_target_ids')
        .split(',')
        .map(Number)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ids.flatMap((id) => samplesByColor[id] ?? []),
      })
    }
    if (u.includes('/formulas')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => formulas })
    }
    // Default: the pantone search response.
    return Promise.resolve({ ok: true, status: 200, json: async () => colors })
  })
}

describe('SearchPage (pantone → formula, batch samples fetched but not rendered)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockImplementation(buildMock(COLORS, FORMULAS, {}))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for the debounce before firing the search and renders the results', async () => {
    renderPage()
    const input = screen.getByLabelText(/buscar color/i)

    // The page loads the formulas list on mount; forget those calls so the
    // assertions below only track the pantone search request.
    await act(async () => {})
    fetchMock.mockClear()

    fireEvent.change(input, { target: { value: '221' } })

    // Before the 250ms debounce window elapses, no search fires.
    await act(async () => {
      await sleep(100)
    })
    expect(fetchMock).not.toHaveBeenCalled()

    // After the debounce settles the request fires with ?q=
    await act(async () => {
      await sleep(350)
    })

    const searchCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/pantone-colors?q='))
    expect(searchCalls).toHaveLength(1)
    expect(String(searchCalls[0][0])).toMatch(/\/api\/v1\/pantone-colors\?q=221/)

    // The returned colors are rendered as PantoneCards (wordmark + PMS code
    // with gamut) plus any matching formulas.
    expect(screen.getByText(/PMS 221 C/)).toBeTruthy()
    expect(screen.getByText(/PMS 2210 C/)).toBeTruthy()
  })

  it('renders each search result as a PantoneCard, not the legacy flat box', async () => {
    renderPage()
    const input = screen.getByLabelText(/buscar color/i)
    await act(async () => {})
    fetchMock.mockClear()

    fireEvent.change(input, { target: { value: '221' } })
    await act(async () => {
      await sleep(350)
    })

    // Each result is a semantic article card carrying the PANTONE® wordmark.
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('PANTONE®')).toBeTruthy()
  })

  it('fetches reusable samples for all results in ONE batch call (N+1 fix)', async () => {
    const sample = {
      id: 100,
      pantone_target_id: 1,
      photo_url: '/uploads/sample-a.jpg',
      status: 'archivada_reutilizable',
      notes: null,
    }
    fetchMock.mockImplementation(buildMock(COLORS, FORMULAS, { 1: [sample] }))

    renderPage()
    const input = screen.getByLabelText(/buscar color/i)

    await act(async () => {})
    fetchMock.mockClear()

    fireEvent.change(input, { target: { value: '221' } })
    await act(async () => {
      await sleep(350)
    })

    // Two results → exactly ONE samples request carrying both ids, with the
    // reusable status so the backend keeps its cap-5-per-color window.
    const sampleCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/samples?'))
    expect(sampleCalls).toHaveLength(1)
    const url = new URL(String(sampleCalls[0][0]), 'http://localhost')
    expect(url.searchParams.get('pantone_target_ids').split(',').map(Number)).toEqual([1, 2])
    expect(url.searchParams.get('status')).toBe('archivada_reutilizable')

    // The batch contract survives the redesign, but samples are NO longer
    // rendered on the search results — they are viewed from PantoneDetail.
    expect(screen.queryByAltText('Muestra reutilizable de 221 C')).toBeNull()
    expect(screen.queryByText(/Muestras reutilizables/)).toBeNull()
  })

  it('does NOT render reusable samples in the search results (viewed from PantoneDetail)', async () => {
    const sample = {
      id: 100,
      pantone_target_id: 1,
      photo_url: '/uploads/sample-a.jpg',
      status: 'archivada_reutilizable',
      notes: null,
    }
    fetchMock.mockImplementation(buildMock(COLORS, FORMULAS, { 1: [sample] }))

    renderPage()
    const input = screen.getByLabelText(/buscar color/i)

    await act(async () => {})
    fireEvent.change(input, { target: { value: '221' } })
    await act(async () => {
      await sleep(350)
    })

    // No SampleFicha thumbnails, no "Muestras reutilizables" block: the search
    // flow stays focused on colors → detail.
    expect(screen.queryByAltText('Muestra reutilizable de 221 C')).toBeNull()
    expect(screen.queryByText(/Muestras reutilizables/)).toBeNull()
    // The two PantoneCards still render.
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
})

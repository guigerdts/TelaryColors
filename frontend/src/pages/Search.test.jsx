import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import SearchPage from './Search.jsx'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const COLORS = [
  { id: 1, code: '221 C', gamut: 'C', paint_type: 'reactiva' },
  { id: 2, code: '2210 C', gamut: 'C', paint_type: 'pigmento' },
]

const FORMULAS = [{ id: 10, pantone_color_id: 1, name: 'Fórmula 221', ingredients: [] }]

// Routed fetch mock so the page's search, formulas, and per-result sample
// requests each get the data they need.
function buildMock(colors, formulas, samplesByColor) {
  return vi.fn((url) => {
    const u = String(url)
    if (u.includes('/samples?pantone_target_id=')) {
      const id = Number(new URL(u, 'http://localhost').searchParams.get('pantone_target_id'))
      return Promise.resolve({ ok: true, status: 200, json: async () => samplesByColor[id] ?? [] })
    }
    if (u.includes('/formulas')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => formulas })
    }
    // Default: the pantone search response.
    return Promise.resolve({ ok: true, status: 200, json: async () => colors })
  })
}

describe('SearchPage (pantone → formula + reusable samples)', () => {
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
    render(<SearchPage />)
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

    // The returned colors are rendered (along with any matching formulas).
    expect(screen.getByText(/221 C/)).toBeTruthy()
    expect(screen.getByText(/2210 C/)).toBeTruthy()
  })

  it('fetches and renders reusable samples for each search result', async () => {
    const sample = {
      id: 100,
      pantone_target_id: 1,
      photo_url: '/uploads/sample-a.jpg',
      status: 'archivada_reutilizable',
      notes: null,
    }
    fetchMock.mockImplementation(buildMock(COLORS, FORMULAS, { 1: [sample] }))

    render(<SearchPage />)
    const input = screen.getByLabelText(/buscar color/i)

    await act(async () => {})
    fireEvent.change(input, { target: { value: '221' } })
    await act(async () => {
      await sleep(350)
    })

    // The color card for 221 C (id 1) shows its reusable sample photo.
    const img = screen.getByAltText('Muestra reutilizable de 221 C')
    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('src', '/uploads/sample-a.jpg')
  })

  it('only renders photo thumbnails while counting every reusable sample', async () => {
    const withPhoto = {
      id: 100,
      pantone_target_id: 1,
      photo_url: '/uploads/sample-a.jpg',
      status: 'archivada_reutilizable',
      notes: null,
    }
    const withoutPhoto = {
      id: 101,
      pantone_target_id: 1,
      photo_url: null,
      status: 'archivada_reutilizable',
      notes: 'muestra sin foto',
    }
    fetchMock.mockImplementation(buildMock(COLORS, FORMULAS, { 1: [withPhoto, withoutPhoto] }))

    render(<SearchPage />)
    const input = screen.getByLabelText(/buscar color/i)

    await act(async () => {})
    fireEvent.change(input, { target: { value: '221' } })
    await act(async () => {
      await sleep(350)
    })

    // Count includes the photo-less sample, but only the photo sample renders an <img>.
    expect(screen.getByText(/Muestras reutilizables \(2\)/)).toBeTruthy()
    const imgs = screen.getAllByAltText('Muestra reutilizable de 221 C')
    expect(imgs).toHaveLength(1)
    // Only color 1 (221 C) has a ficha block; color 2 (2210 C) renders none.
    expect(screen.getAllByText(/Muestras reutilizables/)).toHaveLength(1)
  })
})

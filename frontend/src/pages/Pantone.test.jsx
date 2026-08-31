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

  it('includes hex_color=null when submitting without a hex value', async () => {
    render(<PantonePage />)
    await act(async () => {})

    // Fill in required fields but leave HEX empty.
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '281' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    await act(async () => {})

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/pantone-colors'),
    )
    expect(postCall).toBeTruthy()
    const body = JSON.parse(postCall[1].body)
    expect(body.hex_color).toBeNull()
  })

  it('includes hex_color when submitting with a typed hex value', async () => {
    render(<PantonePage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '281' } })
    fireEvent.change(screen.getByLabelText(/hex/i), { target: { value: '#00205b' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    await act(async () => {})

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/pantone-colors'),
    )
    expect(postCall).toBeTruthy()
    const body = JSON.parse(postCall[1].body)
    expect(body.hex_color).toBe('#00205b')
  })

  it('loads existing color into the form when clicking Editar, then updates via PATCH', async () => {
    const EDIT_COLOR = { id: 7, code: 'Negro', gamut: 'C', paint_type: 'reactiva', hex_color: null }
    const UPDATED = { ...EDIT_COLOR, hex_color: '#000000' }

    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') return okJson([EDIT_COLOR])
      if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
      if (String(url).includes('/pantone-colors/7') && method === 'PATCH') return okJson(UPDATED)
      // After PATCH the list endpoint should be hit again for refresh.
      if (String(url).includes('/pantone-colors') && method === 'GET') return okJson([UPDATED])
      return okJson([])
    })

    render(<PantonePage />)
    await act(async () => {})

    // The Editar button should be present.
    const editBtn = screen.getByRole('button', { name: /editar negro/i })
    expect(editBtn).toBeTruthy()

    // Click Editar — form should pre-load the existing values.
    fireEvent.click(editBtn)

    const codeInput = screen.getByLabelText(/código/i)
    const hexInput = screen.getByLabelText(/hex/i)
    expect(codeInput.value).toBe('Negro')
    // hex_color was null → field shows empty string.
    expect(hexInput.value).toBe('')

    // Change the hex value and submit.
    fireEvent.change(hexInput, { target: { value: '#000000' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await act(async () => {})

    // Verify PATCH was called with the right payload.
    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/pantone-colors/7'),
    )
    expect(patchCall).toBeTruthy()
    const body = JSON.parse(patchCall[1].body)
    expect(body).toEqual(
      expect.objectContaining({ code: 'Negro', gamut: 'C', paint_type: 'reactiva', hex_color: '#000000' }),
    )

    // The list should have been refetched (refresh).
    const getCalls = fetchMock.mock.calls.filter(
      ([url, init]) => (init?.method ?? 'GET') === 'GET' && String(url).includes('/pantone-colors') && !String(url).includes('hex'),
    )
    // At least one GET after the PATCH (initial load + refresh).
    expect(getCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('triggers suggestPantoneHex when code changes and hex is empty', async () => {
    // Make the hex endpoint return a suggestion.
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors/hex')) return okJson({ hex_color: '#00205b' })
      if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
      if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
      return okJson([])
    })

    render(<PantonePage />)
    await act(async () => {})

    // Type a code — this should trigger the suggest effect.
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '281' } })
    await act(async () => {})

    const suggestCall = fetchMock.mock.calls.find(
      ([url]) => String(url).includes('/pantone-colors/hex'),
    )
    expect(suggestCall).toBeTruthy()
    expect(String(suggestCall[0])).toContain('code=281')
  })
})

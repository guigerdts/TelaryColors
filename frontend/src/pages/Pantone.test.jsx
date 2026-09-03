// Pantone page (Slice F) — the color catalog renders every pantone as a
// PantoneCard (not the legacy Fase 1 table), the gamut selector offers the
// real options C/TPX/U as a validated <select> (never free text), and the
// delete action still works from the card listing (pantone-card spec
// "Gamut Selector").
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PantonePage from './Pantone.jsx'

const renderPage = () => render(<MemoryRouter><PantonePage /></MemoryRouter>)

// PantoneCard's action buttons carry no per-card aria-label (the UX overhaul
// dropped labels like "eliminar 211"; they are plain "Eliminar"/"Editar" text
// today), so resolve the target card by its PMS code and scope the action
// query inside that card — this also disambiguates the multi-card listing.
const cardFor = (pmsText) =>
  screen.getAllByRole('article').find((card) => within(card).queryByText(pmsText))

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
    renderPage()
    await act(async () => {})

    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('PANTONE®')).toBeTruthy()
    expect(screen.getByText('PMS 211 C')).toBeTruthy()
    expect(screen.getByText('PMS 2210 TPX')).toBeTruthy()
    // The Fase 1 table is gone.
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('does NOT delete until the operator confirms in the dialog', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.click(within(cardFor('PMS 211 C')).getByRole('button', { name: 'Eliminar' }))
    await act(async () => {})

    // A confirmation dialog appears and the delete has NOT run yet.
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    const del = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'DELETE' && String(url).includes('/pantone-colors/1'),
    )
    expect(del).toBeUndefined()
  })

  it('deletes a color only after confirming in the dialog', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.click(within(cardFor('PMS 211 C')).getByRole('button', { name: 'Eliminar' }))
    await act(async () => {})
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    await act(async () => {})

    const del = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'DELETE' && String(url).includes('/pantone-colors/1'),
    )
    expect(del).toBeTruthy()
    // The card for the deleted color disappears from the listing.
    expect(screen.queryByText('PMS 211 C')).toBeNull()
  })

  it('shows visible error feedback when a confirmed delete fails', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
      if (String(url).includes('/pantone-colors') && method === 'DELETE') {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ detail: 'No se pudo eliminar' }) })
      }
      return okJson([])
    })
    renderPage()
    await act(async () => {})

    fireEvent.click(within(cardFor('PMS 211 C')).getByRole('button', { name: 'Eliminar' }))
    await act(async () => {})
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }))
    await act(async () => {})

    expect(screen.getByText(/no se pudo eliminar/i)).toBeTruthy()
  })

  it('offers the real gamuts C/TPX/U as select options, never free text', async () => {
    renderPage()
    await act(async () => {})

    const gamut = screen.getByLabelText(/gamut/i)
    expect(gamut.tagName).toBe('SELECT')
    const options = within(gamut).getAllByRole('option').map((o) => o.value)
    // Only the real gamuts are selectable — an out-of-range value cannot even
    // be expressed in the UI (pantone-card spec: only the real options allowed).
    expect(options).toEqual(['C', 'TPX', 'U'])
  })

  it('includes hex_color=null when submitting without a hex value', async () => {
    renderPage()
    await act(async () => {})

    // Fill in required fields but leave HEX empty.
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '281' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    await act(async () => {})
    // Confirm in the dialog to complete the create.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/pantone-colors'),
    )
    expect(postCall).toBeTruthy()
    const body = JSON.parse(postCall[1].body)
    expect(body.hex_color).toBeNull()
  })

  it('includes hex_color when submitting with a typed hex value', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '281' } })
    fireEvent.change(screen.getByLabelText(/hex/i), { target: { value: '#00205b' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    await act(async () => {})
    // Confirm in the dialog to complete the create.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
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

    renderPage()
    await act(async () => {})

    // The Editar button should be present (scoped to the 'PMS Negro C' card).
    const editBtn = within(cardFor('PMS Negro C')).getByRole('button', { name: 'Editar' })
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
    // Confirm in the dialog to complete the update.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
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

  it('debounces suggestPantoneHex: no request while typing, one after 250ms of quiet', async () => {
    vi.useFakeTimers()
    try {
      // Make the hex endpoint return a suggestion.
      fetchMock.mockImplementation((url, init) => {
        const method = init?.method ?? 'GET'
        if (String(url).includes('/pantone-colors/hex')) return okJson({ hex_color: '#00205b' })
        if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
        if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
        return okJson([])
      })

      renderPage()
      await act(async () => {}) // flush the initial color list load

      // Type a code — three keystrokes inside the debounce window must NOT fire
      // a suggest per keystroke (P0: the hex auto-suggest is debounced at 250ms).
      const codeInput = screen.getByLabelText(/código/i)
      fireEvent.change(codeInput, { target: { value: '2' } })
      fireEvent.change(codeInput, { target: { value: '28' } })
      fireEvent.change(codeInput, { target: { value: '281' } })
      await act(async () => {}) // no timers advanced — nothing may have fired

      const before = fetchMock.mock.calls.filter(([url]) => String(url).includes('/pantone-colors/hex'))
      expect(before).toHaveLength(0)

      // After the quiet window elapses, exactly ONE suggest fires with the final code.
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {}) // flush the suggest promise + setHex

      const after = fetchMock.mock.calls.filter(([url]) => String(url).includes('/pantone-colors/hex'))
      expect(after).toHaveLength(1)
      expect(String(after[0][0])).toContain('code=281')
    } finally {
      vi.useRealTimers()
    }
  })

  it('fires suggestPantoneHex immediately when the gamut changes (gamut is not debounced)', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementation((url, init) => {
        const method = init?.method ?? 'GET'
        if (String(url).includes('/pantone-colors/hex')) return okJson({ hex_color: '#00205b' })
        if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
        if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
        return okJson([])
      })

      renderPage()
      await act(async () => {})

      // Settle a code so the form has a debounced code and a suggested hex.
      fireEvent.change(screen.getByLabelText(/código/i), { target: { value: '281' } })
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await act(async () => {})

      // Clear the suggested hex — the field must be empty for auto-suggest to run.
      fireEvent.change(screen.getByLabelText(/hex/i), { target: { value: '' } })

      // Changing the gamut fires immediately: gamut is an intentional change,
      // not typing, so it stays a direct (non-debounced) effect dependency.
      fireEvent.change(screen.getByLabelText(/gamut/i), { target: { value: 'TPX' } })
      await act(async () => {})

      const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/pantone-colors/hex'))
      // The trailing call carries the new gamut and happened without advancing timers.
      expect(calls.length).toBeGreaterThanOrEqual(1)
      expect(String(calls[calls.length - 1][0])).toContain('gamut=TPX')
    } finally {
      vi.useRealTimers()
    }
  })

  // ── Regression: stale hex state between consecutive creates ────────────

  it('consecutive creates: "224 → save → 345" shows hex for 345, not 224', async () => {
    vi.useFakeTimers()
    try {
      const hexMap = { '224': '#AA1111', '345': '#11BB22' }
      fetchMock.mockImplementation((url, init) => {
        const method = init?.method ?? 'GET'
        if (String(url).includes('/pantone-colors/hex')) {
          const code = String(url).match(/code=([^&]+)/)?.[1]
          return okJson({ hex_color: hexMap[code] || null })
        }
        if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
        if (String(url).includes('/pantone-colors') && method === 'POST') {
          return okJson({ id: 99, code: '224', gamut: 'C', paint_type: 'reactiva', hex_color: '#AA1111' })
        }
        if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
        return okJson([])
      })

      renderPage()
      await act(async () => {})

      // ── Create 224 ──────────────────────────────────────────────────
      const codeInput = screen.getByLabelText(/código/i)
      fireEvent.change(codeInput, { target: { value: '224' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {}) // flush suggest

      const hexInput = screen.getByLabelText(/hex/i)
      expect(hexInput.value).toBe('#AA1111')

      // Submit and confirm
      fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
      await act(async () => {})
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
      await act(async () => {})

      // Form is cleared after save
      expect(codeInput.value).toBe('')
      expect(hexInput.value).toBe('')

      // ── Create 345 ──────────────────────────────────────────────────
      fireEvent.change(codeInput, { target: { value: '345' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {}) // flush suggest

      // The hex MUST be for 345, NOT the stale 224 value
      expect(hexInput.value).toBe('#11BB22')
      expect(hexInput.value).not.toBe('#AA1111')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stale response: late resolve from "224" does not overwrite hex for "345"', async () => {
    vi.useFakeTimers()
    try {
      // Simulate slow "224" response and fast "345" response
      let resolve224
      const promise224 = new Promise((r) => { resolve224 = r })

      fetchMock.mockImplementation((url, init) => {
        const method = init?.method ?? 'GET'
        if (String(url).includes('/pantone-colors/hex')) {
          const code = String(url).match(/code=([^&]+)/)?.[1]
          if (code === '224') return promise224.then((hex) => ({ hex_color: hex }))
          if (code === '345') return okJson({ hex_color: '#11BB22' })
        }
        if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
        if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
        return okJson([])
      })

      renderPage()
      await act(async () => {})

      const codeInput = screen.getByLabelText(/código/i)
      const hexInput = screen.getByLabelText(/hex/i)

      // Type "224" → suggest fires, but response is pending
      fireEvent.change(codeInput, { target: { value: '224' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {}) // suggest request fired, but response is pending

      // Immediately change to "345" — old "224" response hasn't arrived yet
      fireEvent.change(codeInput, { target: { value: '345' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {}) // "345" suggest fires and resolves

      expect(hexInput.value).toBe('#11BB22')

      // NOW the stale "224" response arrives late
      await act(async () => {
        resolve224('#AA1111')
      })
      await act(async () => {})

      // Hex must STILL be for "345" — the stale "224" response was discarded
      expect(hexInput.value).toBe('#11BB22')
      expect(hexInput.value).not.toBe('#AA1111')
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancel clears suggest state: "224 → cancel → 345" works cleanly', async () => {
    vi.useFakeTimers()
    try {
      const hexMap = { '224': '#AA1111', '345': '#11BB22' }
      fetchMock.mockImplementation((url, init) => {
        const method = init?.method ?? 'GET'
        if (String(url).includes('/pantone-colors/hex')) {
          const code = String(url).match(/code=([^&]+)/)?.[1]
          return okJson({ hex_color: hexMap[code] || null })
        }
        if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
        if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
        return okJson([])
      })

      renderPage()
      await act(async () => {})

      const codeInput = screen.getByLabelText(/código/i)
      const hexInput = screen.getByLabelText(/hex/i)

      // Type "224" → suggest fires → hex populated
      fireEvent.change(codeInput, { target: { value: '224' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {})
      expect(hexInput.value).toBe('#AA1111')

      // Clear the form manually (simulating cancel by resetting fields)
      fireEvent.change(codeInput, { target: { value: '' } })
      fireEvent.change(hexInput, { target: { value: '' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {})

      // Type "345" → suggest fires → hex must be for 345
      fireEvent.change(codeInput, { target: { value: '345' } })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => {})

      expect(hexInput.value).toBe('#11BB22')
      expect(hexInput.value).not.toBe('#AA1111')
    } finally {
      vi.useRealTimers()
    }
  })

  it('three consecutive creates: "224 → 345 → 512" each shows its own hex', async () => {
    vi.useFakeTimers()
    try {
      const hexMap = { '224': '#AA1111', '345': '#11BB22', '512': '#3344CC' }
      fetchMock.mockImplementation((url, init) => {
        const method = init?.method ?? 'GET'
        if (String(url).includes('/pantone-colors/hex')) {
          const code = String(url).match(/code=([^&]+)/)?.[1]
          return okJson({ hex_color: hexMap[code] || null })
        }
        if (String(url).includes('/pantone-colors') && method === 'GET') return okJson(COLORS)
        if (String(url).includes('/pantone-colors') && method === 'POST') return okJson({})
        if (String(url).includes('/pantone-colors') && method === 'DELETE') return okJson(null)
        return okJson([])
      })

      renderPage()
      await act(async () => {})

      const codeInput = screen.getByLabelText(/código/i)
      const hexInput = screen.getByLabelText(/hex/i)

      for (const [code, expectedHex] of [['224', '#AA1111'], ['345', '#11BB22'], ['512', '#3344CC']]) {
        fireEvent.change(codeInput, { target: { value: code } })
        await act(async () => { vi.advanceTimersByTime(250) })
        await act(async () => {})

        expect(hexInput.value).toBe(expectedHex)

        // Submit and confirm
        fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
        await act(async () => {})
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
        await act(async () => {})

        expect(codeInput.value).toBe('')
        expect(hexInput.value).toBe('')
      }
    } finally {
      vi.useRealTimers()
    }
  })
})

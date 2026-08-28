import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import SearchPage from './Search.jsx'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('SearchPage (pantone → formula)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 1, code: '221 C', gamut: 'C', paint_type: 'reactiva' },
        { id: 2, code: '2210 C', gamut: 'C', paint_type: 'pigmento' },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for the debounce before firing the search and renders the results', async () => {
    render(<SearchPage />)
    const input = screen.getByLabelText(/buscar color/i)

    // The page loads the formulas list on mount; forget that call so the
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url).toMatch(/\/api\/v1\/pantone-colors\?q=221/)

    // The returned colors are rendered (along with any matching formulas).
    expect(screen.getByText(/221 C/)).toBeTruthy()
    expect(screen.getByText(/2210 C/)).toBeTruthy()
  })
})

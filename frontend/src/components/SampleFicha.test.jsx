// SampleFicha component — reformatted ficha of one reusable sample. Renders
// the sample's photo thumbnail (or a "sin foto" placeholder) and a "Promover"
// button that fires promoteSample → POST /samples/{id}/promote. Slice F.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import SampleFicha from './SampleFicha.jsx'

const SAMPLE = {
  id: 100,
  pantone_target_id: 1,
  photo_url: '/uploads/sample-a.jpg',
  status: 'archivada_reutilizable',
  notes: null,
}

describe('SampleFicha (thumbnail + promote)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/promote') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ formula: { id: 9 }, sample: { id: SAMPLE.id, status: 'aprobada', formula_id: 9 } }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the photo thumbnail for a sample that has one', () => {
    render(<SampleFicha sample={SAMPLE} colorCode="221 C" />)
    const img = screen.getByAltText('Muestra reutilizable de 221 C')
    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('src', '/uploads/sample-a.jpg')
  })

  it('shows a placeholder instead of a thumbnail when there is no photo', () => {
    const withoutPhoto = { ...SAMPLE, photo_url: null }
    render(<SampleFicha sample={withoutPhoto} colorCode="221 C" />)
    expect(screen.getByText('Sin foto')).toBeTruthy()
    expect(screen.queryByAltText('Muestra reutilizable de 221 C')).toBeNull()
  })

  it('calls promoteSample (POST /samples/{id}/promote) when Promover is clicked', async () => {
    render(<SampleFicha sample={SAMPLE} colorCode="221 C" />)
    fireEvent.click(screen.getByRole('button', { name: 'Promover' }))
    await act(async () => {})

    const promoteCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/samples/100/promote'),
    )
    expect(promoteCall).toBeTruthy()
    expect(String(promoteCall[0])).toContain('/api/v1/samples/100/promote')
  })
})

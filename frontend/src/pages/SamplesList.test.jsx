// SamplesList — Spanish UI. The "Muestras" destination now points here (the
// nav dead-end fix): a browse page listing every sample (GET /samples with no
// filters, newest-first) as design-system cards, each resolving its Pantone
// target code and embedding the reusable SampleFicha. A "Nueva muestra" button
// links to the create form at /muestras.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SamplesListPage from './SamplesList.jsx'

const SAMPLE_1 = {
  id: 11,
  pantone_target_id: 1,
  formula_id: null,
  photo_url: '/uploads/lluvia.jpg',
  status: 'archivada_reutilizable',
  notes: 'Quedó ligeramente más cálido que el objetivo',
  created_by: 3,
  created_at: '2026-08-30T10:00:00',
}

const SAMPLE_2 = {
  id: 12,
  pantone_target_id: 2,
  formula_id: null,
  photo_url: null,
  status: 'descartada',
  notes: null,
  created_by: 3,
  created_at: '2026-08-29T09:00:00',
}

const PANTONE_1 = { id: 1, code: '221', gamut: 'C', paint_type: 'reactiva' }
const PANTONE_2 = { id: 2, code: '2210', gamut: 'U', paint_type: 'pigmento' }

// Mock the API module so each test controls the samples + pantone responses.
vi.mock('../api/index.js', () => ({
  listSamples: vi.fn(),
  listPantone: vi.fn(),
}))

import { listPantone, listSamples } from '../api/index.js'

// Render inside a MemoryRouter because the "Nueva muestra" button is a Link.
function renderList(initialEntries = ['/muestras/lista']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SamplesListPage />
    </MemoryRouter>,
  )
}

describe('SamplesList (browse page)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSamples.mockResolvedValue([SAMPLE_1, SAMPLE_2])
    listPantone.mockResolvedValue([PANTONE_1, PANTONE_2])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('heading, list, and a Nueva muestra button pointing at the create form', async () => {
    renderList()
    await act(async () => {})

    expect(screen.getByRole('heading', { name: /muestras/i })).toBeTruthy()
    expect(listSamples).toHaveBeenCalledTimes(1)
    expect(listPantone).toHaveBeenCalledTimes(1)

    const newButton = screen.getByRole('link', { name: /nueva muestra/i })
    expect(newButton.getAttribute('href')).toBe('/muestras')
  })

  it('renders each sample as a card resolving its Pantone target code', async () => {
    renderList()
    await act(async () => {})

    // One card per sample.
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(2)

    // First card shows the resolved Pantone code ("221 C") and its notes.
    expect(within(cards[0]).getByText(/221 C/)).toBeTruthy()
    expect(within(cards[0]).getByText(/Quedó ligeramente más cálido/)).toBeTruthy()

    // Second card shows its resolved code and a no-photo placeholder (the
    // card's own block plus SampleFicha's thumbnail placeholder both say it).
    expect(within(cards[1]).getByText(/2210 U/)).toBeTruthy()
    expect(within(cards[1]).getAllByText(/Sin foto/).length).toBeGreaterThan(0)
  })

  it('shows a loading state while fetching', () => {
    listSamples.mockReturnValue(new Promise(() => {}))
    renderList()
    expect(screen.getByText(/cargando/i)).toBeTruthy()
  })

  it('shows an empty state when there are no samples', async () => {
    listSamples.mockResolvedValue([])
    renderList()
    await act(async () => {})
    expect(screen.getByText(/no hay muestras/i)).toBeTruthy()
  })

  it('shows an error and recovers via retry', async () => {
    listSamples.mockRejectedValueOnce(new Error('No se pudieron cargar las muestras'))
    renderList()
    await act(async () => {})
    expect(screen.getByText(/No se pudieron cargar las muestras/)).toBeTruthy()

    listSamples.mockResolvedValue([SAMPLE_1])
    await act(async () => {
      screen.getByRole('button', { name: /reintentar/i }).click()
    })
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
})

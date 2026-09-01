// PantoneDetail — self-loading ficha (Punto 2). The component resolves its
// own data from the URL via useParams, filtering the formulas list and
// fetching the detail on mount. Supports multiple formula selection.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import PantoneDetail from '../pages/PantoneDetail.jsx'

const PANTONE = { id: 1, code: '211', gamut: 'C', hex_color: '#E63950', paint_type: 'reactiva' }

const FORMULA_1 = { id: 7, name: 'Fórmula coral 211', pantone_color_id: 1 }
const FORMULA_2 = { id: 8, name: 'Fórmula roja 211', pantone_color_id: 1 }

const DETAIL_1 = {
  id: 7,
  name: 'Fórmula coral 211',
  pantone_color_id: 1,
  ingredients: [
    { id: 1, colorant: 'Blanco', quantity_g: '820.0' },
    { id: 2, colorant: 'Rojo rubí', quantity_g: '130.0' },
  ],
  designs: [
    { id: 11, name: 'Linterna Coral', client: 'Telary Home', notes: null },
    { id: 12, name: 'Vasija Fuego', client: null, notes: null },
  ],
}

const DETAIL_2 = {
  id: 8,
  name: 'Fórmula roja 211',
  pantone_color_id: 1,
  ingredients: [
    { id: 3, colorant: 'Rojo fuego', quantity_g: '900.0' },
  ],
  designs: [],
}

const DESIGNS = [
  { id: 21, name: 'Linterna Coral', client: 'Telary Home', notes: null },
  { id: 22, name: 'Maceta Norte', client: null, notes: null },
]

// Mock the API module so each test can control responses.
vi.mock('../api/index.js', () => ({
  listFormulas: vi.fn(),
  getFormulaDetail: vi.fn(),
  listPantone: vi.fn(),
  listDesigns: vi.fn().mockResolvedValue([]),
  linkDesignToFormula: vi.fn(),
}))

import { getFormulaDetail, listDesigns, listFormulas, listPantone } from '../api/index.js'

// Helper to render PantoneDetail inside a MemoryRouter matching /pantone/:id.
function renderDetail(pantoneId = 1) {
  return render(
    <MemoryRouter initialEntries={[`/pantone/${pantoneId}`]}>
      <Routes>
        <Route path="/pantone/:id" element={<PantoneDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PantoneDetail (self-loading ficha)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPantone.mockResolvedValue([PANTONE])
    listFormulas.mockResolvedValue([FORMULA_1])
    getFormulaDetail.mockResolvedValue(DETAIL_1)
    listDesigns.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads formulas + detail from URL and renders the ficha', async () => {
    renderDetail(1)
    await act(async () => {})

    // listFormulas called to discover the pantone's formulas.
    expect(listFormulas).toHaveBeenCalledTimes(1)
    // listPantone called to resolve the pantone metadata.
    expect(listPantone).toHaveBeenCalledTimes(1)
    // getFormulaDetail called with the first formula's id.
    expect(getFormulaDetail).toHaveBeenCalledWith(7)

    // Formula + designs rendered from the detail response.
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
    const designsSection = screen.getByRole('region', {
      name: 'Diseños que usan esta fórmula',
    })
    expect(within(designsSection).getByText('Linterna Coral')).toBeTruthy()
  })

  it('shows a loading state while fetching', () => {
    listFormulas.mockReturnValue(new Promise(() => {}))
    renderDetail(1)
    expect(screen.getByText(/Cargando/)).toBeTruthy()
  })

  it('shows an error and recovers via retry', async () => {
    getFormulaDetail.mockRejectedValueOnce(new Error('Fórmula no encontrada'))
    renderDetail(1)
    await act(async () => {})
    expect(screen.getByText(/Fórmula no encontrada/)).toBeTruthy()

    // Retry recovers.
    getFormulaDetail.mockResolvedValue(DETAIL_1)
    await act(async () => {
      screen.getByRole('button', { name: /Reintentar/i }).click()
    })
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
  })

  it('shows a message when no formulas exist for the pantone', async () => {
    listFormulas.mockResolvedValue([])
    renderDetail(1)
    await act(async () => {})

    expect(screen.getByText(/no hay fórmulas/i)).toBeTruthy()
    expect(getFormulaDetail).not.toHaveBeenCalled()
  })

  it('does NOT show a formula selector when there is only one formula', async () => {
    listFormulas.mockResolvedValue([FORMULA_1])
    renderDetail(1)
    await act(async () => {})

    expect(screen.queryByRole('combobox', { name: /fórmula/i })).toBeNull()
  })

  it('shows a formula selector when there are multiple formulas', async () => {
    listFormulas.mockResolvedValue([FORMULA_1, FORMULA_2])
    getFormulaDetail.mockResolvedValue(DETAIL_1)
    renderDetail(1)
    await act(async () => {})

    const selector = screen.getByRole('combobox', { name: /fórmula/i })
    // Two options (one per formula).
    expect(within(selector).getAllByRole('option')).toHaveLength(2)
  })

  it('switches formula when selector changes', async () => {
    listFormulas.mockResolvedValue([FORMULA_1, FORMULA_2])
    getFormulaDetail.mockResolvedValueOnce(DETAIL_1)
    getFormulaDetail.mockResolvedValueOnce(DETAIL_2)
    renderDetail(1)
    await act(async () => {})

    expect(getFormulaDetail).toHaveBeenCalledTimes(1)
    expect(getFormulaDetail).toHaveBeenLastCalledWith(7)

    const selector = screen.getByRole('combobox', { name: /fórmula/i })
    fireEvent.change(selector, { target: { value: '8' } })
    await act(async () => {})
    // After change, getFormulaDetail called with the second formula id.
    expect(getFormulaDetail).toHaveBeenCalledTimes(2)
    expect(getFormulaDetail).toHaveBeenLastCalledWith(8)
  })

  it('renders an empty designs section when detail has no designs', async () => {
    getFormulaDetail.mockResolvedValue({ ...DETAIL_1, designs: [] })
    renderDetail(1)
    await act(async () => {})

    const designsSection = screen.getByRole('region', {
      name: 'Diseños que usan esta fórmula',
    })
    expect(within(designsSection).getByText(/Sin diseños vinculados/)).toBeTruthy()
  })

  it('manually links an existing design via linkDesignToFormula', async () => {
    listDesigns.mockResolvedValue(DESIGNS)
    const { linkDesignToFormula } = await import('../api/index.js')
    linkDesignToFormula.mockResolvedValue({ id: 99, formula_id: 7, design_id: 21, source: 'manual' })

    renderDetail(1)
    await act(async () => {})

    const selector = screen.getByLabelText(/vincular diseño/i)
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Linterna Coral',
      'Maceta Norte',
    ])

    await act(async () => {
      fireEvent.change(selector, { target: { value: '21' } })
      fireEvent.click(screen.getByRole('button', { name: /vincular/i }))
    })

    await act(async () => {})
    expect(linkDesignToFormula).toHaveBeenCalledWith(7, { design_id: 21 })
  })
})

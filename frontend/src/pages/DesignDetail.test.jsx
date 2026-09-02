// DesignDetail — Spanish UI. Tests for the design detail page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import DesignDetail from './DesignDetail.jsx'

const PANTONE_COLORS = [
  { id: 10, code: '185 C', hex_color: '#E4002B', name: 'Rojo' },
  { id: 11, code: '281 C', hex_color: '#00205B', name: 'Azul' },
  { id: 12, code: '348 C', hex_color: '#00843D', name: 'Verde' },
]

const DESIGN = {
  id: 1,
  name: 'Colección Aromo',
  paint_type: 'reactiva',
  client: 'Cliente Test',
  notes: 'Notas de prueba',
  created_by: 1,
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-01-15T10:30:00Z',
  colors: [
    { id: 10, pantone_color_id: 10 },
    { id: 11, pantone_color_id: 11 },
  ],
}

const FORMULAS = [
  {
    id: 1,
    pantone_color_id: 10,
    name: 'Fórmula Roja',
    notes: null,
    created_by: 1,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z',
    ingredients: [
      { id: 1, colorant: 'Rojo base', quantity: 50, unit: 'g', quantity_g: 50 },
      { id: 2, colorant: 'Diluyente', quantity: 0.5, unit: 'kg', quantity_g: 500 },
    ],
  },
  {
    id: 2,
    pantone_color_id: 12,
    name: 'Fórmula Verde',
    notes: null,
    created_by: 1,
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z',
    ingredients: [{ id: 3, colorant: 'Verde base', quantity: 100, unit: 'g', quantity_g: 100 }],
  },
]

function renderDetail(designId = 1) {
  return render(
    <MemoryRouter initialEntries={[`/designs/${designId}`]}>
      <Routes>
        <Route path="/designs/:id" element={<DesignDetail />} />
        <Route path="/designs" element={<div>Diseños list</div>} />
        <Route path="/pantone/:id" element={<div>Pantone detail</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DesignDetail', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/designs/1')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGN })
      }
      if (String(url).includes('/pantone-colors')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/formulas')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => FORMULAS })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Loading ────────────────────────────────────────────────────────────
  it('shows loading skeleton while fetching', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))

    renderDetail()
    await act(async () => {})

    // The loading skeleton uses aria-busy="true" and aria-label="Cargando diseño"
    expect(screen.getByLabelText(/cargando diseño/i)).toBeTruthy()
  })

  // ── Render design ──────────────────────────────────────────────────────
  it('renders the design name and paint type', async () => {
    renderDetail()
    await act(async () => {})

    // Name appears in breadcrumb and h1 — check h1 specifically
    const headings = screen.getAllByText('Colección Aromo')
    expect(headings.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('reactiva')).toBeTruthy()
  })

  it('renders client and notes when present', async () => {
    renderDetail()
    await act(async () => {})

    // Client is rendered as "Cliente: {value}" in the header
    const clientElements = screen.getAllByText((_, el) =>
      el?.textContent?.includes('Cliente Test'),
    )
    expect(clientElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Notas de prueba')).toBeTruthy()
  })

  // ── Colors ─────────────────────────────────────────────────────────────
  it('renders the design colors with Pantone codes', async () => {
    renderDetail()
    await act(async () => {})

    expect(screen.getByText('185 C')).toBeTruthy()
    expect(screen.getByText('281 C')).toBeTruthy()
    expect(screen.getByText('#E4002B')).toBeTruthy()
    expect(screen.getByText('#00205B')).toBeTruthy()
  })

  it('renders "Ver" links to Pantone detail for each color', async () => {
    renderDetail()
    await act(async () => {})

    const verLinks = screen.getAllByText('Ver')
    expect(verLinks.length).toBeGreaterThanOrEqual(2)
  })

  // ── Formulas ───────────────────────────────────────────────────────────
  it('renders linked formulas (cross-referenced by pantone_color_id)', async () => {
    renderDetail()
    await act(async () => {})

    // "Fórmula Roja" (pantone 10) is linked; "Fórmula Verde" (pantone 12) is not
    expect(screen.getByText('Fórmula Roja')).toBeTruthy()
    expect(screen.queryByText('Fórmula Verde')).toBeNull()
  })

  it('shows ingredient count for each formula', async () => {
    renderDetail()
    await act(async () => {})

    expect(screen.getByText('2 ingredientes')).toBeTruthy()
  })

  it('shows "Ver ficha" link for each formula', async () => {
    renderDetail()
    await act(async () => {})

    const formulaLinks = screen.getAllByText('Ver ficha')
    expect(formulaLinks.length).toBeGreaterThanOrEqual(1)
  })

  // ── No formulas ────────────────────────────────────────────────────────
  it('shows empty state when no formulas match', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/designs/1')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGN })
      }
      if (String(url).includes('/pantone-colors')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/formulas')) {
        // Return formulas whose pantone_color_id is NOT in the design's colors
        return Promise.resolve({ ok: true, status: 200, json: async () => [FORMULAS[1]] })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    renderDetail()
    await act(async () => {})

    expect(screen.getByText('Sin fórmulas asociadas')).toBeTruthy()
  })

  // ── 404 ────────────────────────────────────────────────────────────────
  it('shows 404 when design does not exist', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/designs/')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ detail: 'Diseño no encontrado' }),
        })
      }
      if (String(url).includes('/pantone-colors')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/formulas')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    renderDetail(999)
    await act(async () => {})

    expect(screen.getByText('Diseño no encontrado')).toBeTruthy()
  })

  // ── Error ──────────────────────────────────────────────────────────────
  it('shows error when API fails', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/designs/')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Error interno' }),
        })
      }
      if (String(url).includes('/pantone-colors')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/formulas')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    renderDetail()
    await act(async () => {})

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Error interno')).toBeTruthy()
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeTruthy()
  })

  // ── Navigation ─────────────────────────────────────────────────────────
  it('has a breadcrumb link back to designs list', async () => {
    renderDetail()
    await act(async () => {})

    // Breadcrumb has a link to /designs — use getAll and check at least one
    const links = screen.getAllByRole('link')
    const designsLink = links.find((l) => l.getAttribute('href') === '/designs')
    expect(designsLink).toBeTruthy()
  })

  it('has a "Volver a Diseños" button', async () => {
    renderDetail()
    await act(async () => {})

    const backLink = screen.getByText('← Volver a Diseños')
    expect(backLink).toBeTruthy()
  })

  // ── Metadata ───────────────────────────────────────────────────────────
  it('shows created date', async () => {
    renderDetail()
    await act(async () => {})

    // Created date: 2025-01-15 in es-AR locale
    expect(screen.getByText(/15\/1\/2025/)).toBeTruthy()
  })
})

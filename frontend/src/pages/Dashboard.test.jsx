import { render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import DashboardPage from './Dashboard.jsx'

// Mock all API calls
vi.mock('../api/index.js', () => ({
  listFormulas: vi.fn(),
  listDesigns: vi.fn(),
  listPantone: vi.fn(),
  listSamples: vi.fn(),
  listInventoryItems: vi.fn(),
}))

import {
  listFormulas,
  listDesigns,
  listPantone,
  listSamples,
  listInventoryItems,
} from '../api/index.js'

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listFormulas.mockResolvedValue([])
    listDesigns.mockResolvedValue([])
    listPantone.mockResolvedValue([])
    listSamples.mockResolvedValue([])
    listInventoryItems.mockResolvedValue([])
  })

  it('shows skeleton while loading', () => {
    listFormulas.mockReturnValue(new Promise(() => {}))
    listDesigns.mockReturnValue(new Promise(() => {}))
    listPantone.mockReturnValue(new Promise(() => {}))
    listSamples.mockReturnValue(new Promise(() => {}))
    listInventoryItems.mockReturnValue(new Promise(() => {}))

    renderDashboard()
    expect(screen.getByLabelText('Cargando dashboard')).toBeInTheDocument()
  })

  it('renders dashboard header with title', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })
  })

  it('renders quick action links', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Buscar color')).toBeInTheDocument()
      // "Diseños" appears in quick actions AND summary — verify at least one is a link
      const designsLinks = screen.getAllByText('Diseños').filter(
        (el) => el.closest('a')?.getAttribute('href') === '/designs',
      )
      expect(designsLinks.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Inventario')).toBeInTheDocument()
    })
  })

  it('shows summary stats with real counts', async () => {
    listPantone.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
    listFormulas.mockResolvedValue([{ id: 1 }, { id: 2 }])
    listDesigns.mockResolvedValue([{ id: 1 }])
    listSamples.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])

    renderDashboard()
    await waitFor(() => {
      // Summary section has "Pantone" label
      expect(screen.getByText('Pantone')).toBeInTheDocument()
      // Check counts appear (stat values)
      const statValues = screen.getAllByText(/^\d+$/)
      const counts = statValues.map((el) => el.textContent)
      expect(counts).toContain('3') // pantone
      expect(counts).toContain('2') // formulas
      expect(counts).toContain('1') // designs
      expect(counts).toContain('4') // samples
    })
  })

  it('shows inventory alerts when bajo_umbral items exist', async () => {
    listInventoryItems.mockResolvedValue([
      { id: 1, name: 'Rojo FT', inventory_status: 'bajo_umbral', current_stock: 2, unit: 'kg' },
      { id: 2, name: 'Azul OT', inventory_status: 'ok', current_stock: 10, unit: 'kg' },
    ])

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Inventario — atención requerida')).toBeInTheDocument()
      expect(screen.getByText('Rojo FT')).toBeInTheDocument()
      expect(screen.queryByText('Azul OT')).not.toBeInTheDocument()
    })
  })

  it('shows recent formulas', async () => {
    listFormulas.mockResolvedValue([
      { id: 1, name: 'Fórmula Roja', pantone_color_id: 1, ingredients: [{}, {}, {}] },
      { id: 2, name: 'Fórmula Azul', pantone_color_id: 2, ingredients: [{}] },
    ])

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Fórmulas recientes')).toBeInTheDocument()
      expect(screen.getByText('Fórmula Roja')).toBeInTheDocument()
      expect(screen.getByText('3 ingredientes')).toBeInTheDocument()
    })
  })

  it('shows recent designs with color dots', async () => {
    listDesigns.mockResolvedValue([
      {
        id: 1,
        name: 'Diseño Test',
        paint_type: 'reactiva',
        colors: [
          { pantone_color_id: 1 },
          { pantone_color_id: 2 },
        ],
      },
    ])
    listPantone.mockResolvedValue([
      { id: 1, code: '185', gamut: 'C', hex_color: '#E4002B', paint_type: 'reactiva' },
      { id: 2, code: '286', gamut: 'C', hex_color: '#00205B', paint_type: 'reactiva' },
    ])

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Diseños recientes')).toBeInTheDocument()
      expect(screen.getByText('Diseño Test')).toBeInTheDocument()
      expect(screen.getByText('2 colores')).toBeInTheDocument()
    })

    // The color swatches should render with real hex colors, not gray fallback.
    const swatches = screen.getAllByRole('img')
    const colorSwatches = swatches.filter((el) =>
      el.getAttribute('aria-label')?.startsWith('PMS'),
    )
    expect(colorSwatches).toHaveLength(2)
    // First swatch should have the real red color, not gray.
    expect(colorSwatches[0]).toHaveStyle({ backgroundColor: '#E4002B' })
    expect(colorSwatches[1]).toHaveStyle({ backgroundColor: '#00205B' })
  })

  it('shows empty state for formulas when none exist', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Sin fórmulas creadas')).toBeInTheDocument()
    })
  })

  it('shows empty state for designs when none exist', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Sin diseños creados')).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    listFormulas.mockRejectedValue(new Error('Network error'))
    listDesigns.mockRejectedValue(new Error('Network error'))
    listPantone.mockRejectedValue(new Error('Network error'))
    listSamples.mockRejectedValue(new Error('Network error'))
    listInventoryItems.mockRejectedValue(new Error('Network error'))

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Reintentar')).toBeInTheDocument()
    })
  })

  it('quick actions link to correct routes', async () => {
    renderDashboard()
    await waitFor(() => {
      const searchLink = screen.getByText('Buscar color').closest('a')
      expect(searchLink).toHaveAttribute('href', '/search')

      const inventoryLink = screen.getByText('Inventario').closest('a')
      expect(inventoryLink).toHaveAttribute('href', '/inventario')
    })
  })

  it('renders search shortcut hint', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Ctrl')).toBeInTheDocument()
      expect(screen.getByText('K')).toBeInTheDocument()
    })
  })

  // ── Regression: design color dots must use real hex from pantone list ──

  it('resolves design color hex from pantone list, not from design colors array', async () => {
    // Real API: design colors only have pantone_color_id, NO hex_color.
    listDesigns.mockResolvedValue([
      {
        id: 1,
        name: 'Colección Real',
        paint_type: 'reactiva',
        colors: [
          { pantone_color_id: 10 },
          { pantone_color_id: 11 },
        ],
      },
    ])
    // Pantone list provides the actual hex values.
    listPantone.mockResolvedValue([
      { id: 10, code: '185', gamut: 'C', hex_color: '#E4002B', paint_type: 'reactiva' },
      { id: 11, code: '281', gamut: 'C', hex_color: '#00205B', paint_type: 'reactiva' },
    ])

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Colección Real')).toBeInTheDocument()
    })

    // Both color swatches must show real hex colors resolved from pantone list.
    const swatches = screen.getAllByRole('img')
    const colorSwatches = swatches.filter((el) =>
      el.getAttribute('aria-label')?.startsWith('PMS'),
    )
    expect(colorSwatches).toHaveLength(2)
    expect(colorSwatches[0]).toHaveStyle({ backgroundColor: '#E4002B' })
    expect(colorSwatches[1]).toHaveStyle({ backgroundColor: '#00205B' })
  })

  it('falls back to neutral swatch when pantone not found in list', async () => {
    listDesigns.mockResolvedValue([
      {
        id: 1,
        name: 'Diseño Huérfano',
        paint_type: 'reactiva',
        colors: [
          { pantone_color_id: 999 },
        ],
      },
    ])
    // Pantone list does NOT include id 999.
    listPantone.mockResolvedValue([])

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Diseño Huérfano')).toBeInTheDocument()
    })

    // The swatch should render with "sin color" label, no background color.
    const swatch = screen.getByRole('img', { name: /PMS 999 — sin color/ })
    expect(swatch).toBeInTheDocument()
    // No inline backgroundColor — neutral swatch uses CSS class only.
    expect(swatch.style.backgroundColor).toBe('')
  })
})

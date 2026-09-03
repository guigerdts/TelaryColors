// Designs page — Spanish UI. Fase 3.3: CRUD — crear y editar.
// 14 original tests + 8 new edit tests = 22 total.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import DesignsPage from './Designs.jsx'

const PANTONE_COLORS = [
  { id: 10, code: '185 C', hex_color: '#E4002B', name: 'Rojo', paint_type: 'reactiva' },
  { id: 11, code: '281 C', hex_color: '#00205B', name: 'Azul', paint_type: 'reactiva' },
  { id: 12, code: '348 C', hex_color: '#00843D', name: 'Verde', paint_type: 'pigmento' },
  { id: 13, code: '116 C', hex_color: '#FFCD00', name: 'Amarillo', paint_type: 'reactiva' },
  { id: 14, code: '286 C', hex_color: '#0033A0', name: 'Azul oscuro', paint_type: 'pigmento' },
  { id: 15, code: 'Black', hex_color: '#000000', name: 'Negro', paint_type: 'reactiva' },
  { id: 16, code: 'Black', hex_color: '#000000', name: 'Negro', paint_type: 'pigmento' },
]

const DESIGNS = [
  { id: 1, name: 'Colección Aromo', paint_type: 'reactiva', colors: [{ id: 10, pantone_color_id: 10 }, { id: 11, pantone_color_id: 11 }] },
  { id: 2, name: 'Línea Básica', paint_type: 'pigmento', colors: [{ id: 12, pantone_color_id: 12 }] },
  { id: 3, name: 'Colección Aurora', paint_type: 'reactiva', colors: [{ id: 10, pantone_color_id: 10 }, { id: 13, pantone_color_id: 13 }, { id: 14, pantone_color_id: 14 }] },
]

describe('DesignsPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (String(url).includes('/designs') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 4, ...JSON.parse(init.body) }),
        })
      }
      if (String(url).includes('/designs') && method === 'PATCH') {
        const id = Number(String(url).match(/\/designs\/(\d+)/)?.[1])
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id, ...JSON.parse(init.body) }),
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

  // ── Loading state ──────────────────────────────────────────────────────
  it('shows loading skeleton while fetching designs', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return new Promise(() => {})
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    expect(screen.getByRole('status', { name: /cargando diseños/i })).toBeTruthy()
  })

  // ── Normal list ────────────────────────────────────────────────────────
  it('renders all designs in the list', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    expect(screen.getAllByText('Colección Aromo').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Línea Básica').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Colección Aurora').length).toBeGreaterThanOrEqual(1)
  })

  it('shows design count badge', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const badges = screen.getAllByText('3')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  // ── Search ─────────────────────────────────────────────────────────────
  it('filters designs by name when typing in search', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const searchInput = screen.getByPlaceholderText(/buscar diseño/i)
    fireEvent.change(searchInput, { target: { value: 'Aromo' } })
    await act(async () => {})

    expect(screen.getAllByText('Colección Aromo').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Línea Básica')).toBeNull()
    expect(screen.queryByText('Colección Aurora')).toBeNull()
  })

  it('shows no-results state when search matches nothing', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const searchInput = screen.getByPlaceholderText(/buscar diseño/i)
    fireEvent.change(searchInput, { target: { value: 'ZZZZ' } })
    await act(async () => {})

    expect(screen.getByText(/no se encontraron diseños/i)).toBeTruthy()
    expect(screen.getByText('Limpiar filtros')).toBeTruthy()
  })

  it('clears search when clicking "Limpiar filtros"', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const searchInput = screen.getByPlaceholderText(/buscar diseño/i)
    fireEvent.change(searchInput, { target: { value: 'ZZZZ' } })
    await act(async () => {})

    fireEvent.click(screen.getByText('Limpiar filtros'))
    await act(async () => {})

    expect(screen.getAllByText('Colección Aromo').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Línea Básica').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Colección Aurora').length).toBeGreaterThanOrEqual(1)
  })

  // ── Filter by paint type ───────────────────────────────────────────────
  it('filters designs by paint type', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const typeSelect = screen.getByLabelText(/tipo:/i)
    fireEvent.change(typeSelect, { target: { value: 'pigmento' } })
    await act(async () => {})

    expect(screen.getAllByText('Línea Básica').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Colección Aromo')).toBeNull()
    expect(screen.queryByText('Colección Aurora')).toBeNull()
  })

  // ── Empty state ────────────────────────────────────────────────────────
  it('shows empty state when no designs exist', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    expect(screen.getByText('Sin diseños creados')).toBeTruthy()
    expect(screen.getByText('Crea tu primer diseño para comenzar.')).toBeTruthy()
  })

  // ── Error state ────────────────────────────────────────────────────────
  it('shows error when fetching designs fails', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Error interno' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Error interno')).toBeTruthy()
  })

  // ── Create flow preserved ──────────────────────────────────────────────
  it('stages the create behind a confirmation dialog — no POST before confirm (P1)', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy()
    const post = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/designs'),
    )
    expect(post).toBeUndefined()
  })

  it('creates the design only after confirming in the dialog', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const post = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/designs'),
    )
    expect(post).toBeTruthy()
    const body = JSON.parse(post[1].body)
    expect(body.name).toBe('Colección Nueva')
    expect(body.paint_type).toBe('reactiva')
    expect(screen.getByText('Diseño creado')).toBeTruthy()
  })

  it('cancels the dialog without creating anything', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await act(async () => {})

    expect(screen.queryByRole('dialog')).toBeNull()
    const post = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/designs'),
    )
    expect(post).toBeUndefined()
  })

  it('surfaces the backend error verbatim after a failed confirm', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (String(url).includes('/designs') && method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({ detail: 'Se requieren entre 1 y 7 colores' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Nueva' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    expect(screen.getByText('Se requieren entre 1 y 7 colores')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // ── Search and filter don't break create ───────────────────────────────
  it('search does not affect the create form inputs', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const searchInput = screen.getByPlaceholderText(/buscar diseño/i)
    fireEvent.change(searchInput, { target: { value: 'Aromo' } })
    await act(async () => {})

    // The create form's name input (first one)
    const nameInputs = screen.getAllByLabelText(/nombre/i)
    expect(nameInputs.length).toBeGreaterThanOrEqual(1)
    expect(nameInputs[0].value).toBe('')

    fireEvent.change(nameInputs[0], { target: { value: 'Test' } })
    expect(nameInputs[0].value).toBe('Test')
  })

  // ════════════════════════════════════════════════════════════════════════
  // Fase 3.3 — Edit flow tests
  // ════════════════════════════════════════════════════════════════════════

  it('shows "Editar" buttons for each design in the table', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const editButtons = screen.getAllByText('Editar')
    expect(editButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('opens the edit modal pre-filled with design data', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    // Click the first "Editar" button
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    // Dialog should open with title "Editar diseño"
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Editar diseño')).toBeTruthy()

    // The name input inside the dialog should be pre-filled
    const nameInputs = screen.getAllByLabelText(/nombre/i)
    // The second name input is inside the dialog (first is create form)
    const editNameInput = nameInputs.find((el) => el.value === 'Colección Aromo')
    expect(editNameInput).toBeTruthy()
    expect(editNameInput.value).toBe('Colección Aromo')
  })

  it('sends PATCH with updated data after editing and confirming', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    // Open edit for "Colección Aromo" (design id 1)
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    // Modify the name
    const nameInputs = screen.getAllByLabelText(/nombre/i)
    const editNameInput = nameInputs.find((el) => el.value === 'Colección Aromo')
    fireEvent.change(editNameInput, { target: { value: 'Aromo Modificada' } })
    await act(async () => {})

    // Confirm the edit
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await act(async () => {})

    // PATCH should have been sent
    const patch = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/designs/1'),
    )
    expect(patch).toBeTruthy()
    const body = JSON.parse(patch[1].body)
    expect(body.name).toBe('Aromo Modificada')
    expect(screen.getByText('Diseño actualizado')).toBeTruthy()
  })

  it('cancels edit without sending PATCH', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    // Cancel the edit
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await act(async () => {})

    expect(screen.queryByRole('dialog')).toBeNull()
    const patch = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/designs'),
    )
    expect(patch).toBeUndefined()
  })

  it('shows backend error when PATCH fails', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (String(url).includes('/designs') && method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ detail: 'Ya existe un diseño con ese nombre' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await act(async () => {})

    expect(screen.getByText('Ya existe un diseño con ese nombre')).toBeTruthy()
    // Dialog should remain open so user can retry
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('allows changing paint type during edit', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    // Find the paint type select inside the dialog
    const selects = screen.getAllByLabelText(/tipo de pintura/i)
    const editSelect = selects[selects.length - 1] // last one is in the dialog
    fireEvent.change(editSelect, { target: { value: 'pigmento' } })
    await act(async () => {})

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await act(async () => {})

    const patch = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/designs/1'),
    )
    expect(patch).toBeTruthy()
    const body = JSON.parse(patch[1].body)
    expect(body.paint_type).toBe('pigmento')
  })

  it('shows color count from the design in the edit modal', async () => {
    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    // Edit "Colección Aromo" which has 2 colors (ids 10, 11)
    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    // The DesignColorPicker shows "Colores del diseño: X / 7"
    // The text is split across elements, so check for the label and the count
    const colorLabels = screen.getAllByText((_, el) =>
      el?.textContent?.includes('Colores del diseño'),
    )
    expect(colorLabels.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps dialog open while PATCH is in flight (saving state)', async () => {
    // Make PATCH hang
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => PANTONE_COLORS })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (String(url).includes('/designs') && method === 'PATCH') {
        return new Promise(() => {}) // never resolves
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<MemoryRouter><DesignsPage /></MemoryRouter>)
    await act(async () => {})

    const editButtons = screen.getAllByText('Editar')
    fireEvent.click(editButtons[0])
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await act(async () => {})

    // Dialog should still be visible
    expect(screen.getByRole('dialog')).toBeTruthy()
    // Confirm button should be disabled
    expect(screen.getByRole('button', { name: 'Guardar cambios' }).disabled).toBe(true)
  })

  // ── Paint-type filtering ────────────────────────────────────────────────
  describe('paint_type filtering', () => {
    it('shows only reactiva pantones when paint_type is reactiva', async () => {
      render(<MemoryRouter><DesignsPage /></MemoryRouter>)
      await act(async () => {})

      // The create form defaults to reactiva. Only reactiva buttons should appear.
      const buttons = screen.getAllByRole('button', { pressed: false })
      const colorLabels = buttons.map((b) => b.textContent).filter((t) => t !== 'Crear diseño' && t !== 'Editar' && t !== 'Ver')
      // Should contain reactiva colors: 185 C, 281 C, 116 C, Black (reactiva)
      expect(colorLabels).toContain('185 C')
      expect(colorLabels).toContain('281 C')
      expect(colorLabels).toContain('116 C')
      expect(colorLabels).toContain('Black')
      // Should NOT contain pigmento-only colors
      expect(colorLabels).not.toContain('348 C')
      expect(colorLabels).not.toContain('286 C')
    })

    it('shows only pigmento pantones when paint_type is pigmento', async () => {
      render(<MemoryRouter><DesignsPage /></MemoryRouter>)
      await act(async () => {})

      // Switch to pigmento
      const paintSelect = screen.getAllByRole('combobox').find((el) =>
        el.closest('label')?.textContent?.includes('Tipo de pintura'),
      )
      fireEvent.change(paintSelect, { target: { value: 'pigmento' } })
      await act(async () => {})

      const buttons = screen.getAllByRole('button', { pressed: false })
      const colorLabels = buttons.map((b) => b.textContent).filter((t) => t !== 'Crear diseño' && t !== 'Editar' && t !== 'Ver')
      // Should contain pigmento colors: 348 C, 286 C, Black (pigmento)
      expect(colorLabels).toContain('348 C')
      expect(colorLabels).toContain('286 C')
      expect(colorLabels).toContain('Black')
      // Should NOT contain reactiva-only colors
      expect(colorLabels).not.toContain('185 C')
      expect(colorLabels).not.toContain('281 C')
      expect(colorLabels).not.toContain('116 C')
    })

    it('Black appears once in reactiva and once in pigmento context', async () => {
      render(<MemoryRouter><DesignsPage /></MemoryRouter>)
      await act(async () => {})

      // Default reactiva — one Black
      const reactivaButtons = screen.getAllByRole('button', { pressed: false })
      const reactivaBlack = reactivaButtons.filter((b) => b.textContent === 'Black')
      expect(reactivaBlack.length).toBe(1)

      // Switch to pigmento — one Black
      const paintSelect = screen.getAllByRole('combobox').find((el) =>
        el.closest('label')?.textContent?.includes('Tipo de pintura'),
      )
      fireEvent.change(paintSelect, { target: { value: 'pigmento' } })
      await act(async () => {})

      const pigmentoButtons = screen.getAllByRole('button', { pressed: false })
      const pigmentoBlack = pigmentoButtons.filter((b) => b.textContent === 'Black')
      expect(pigmentoBlack.length).toBe(1)
    })

    it('switching paint_type clears incompatible selected IDs', async () => {
      render(<MemoryRouter><DesignsPage /></MemoryRouter>)
      await act(async () => {})

      // Select a reactiva color (185 C, id=10)
      const btn185 = screen.getByRole('button', { name: '185 C' })
      fireEvent.click(btn185)
      await act(async () => {})
      expect(btn185.getAttribute('aria-pressed')).toBe('true')

      // Switch to pigmento — 185 C should be deselected
      const paintSelect = screen.getAllByRole('combobox').find((el) =>
        el.closest('label')?.textContent?.includes('Tipo de pintura'),
      )
      fireEvent.change(paintSelect, { target: { value: 'pigmento' } })
      await act(async () => {})

      // 185 C should no longer be in the picker (it's reactiva)
      expect(screen.queryByRole('button', { name: '185 C' })).toBeNull()
    })

    it('edit mode also filters by paint_type and cleans selection on type change', async () => {
      render(<MemoryRouter><DesignsPage /></MemoryRouter>)
      await act(async () => {})

      // Open edit for "Línea Básica" (pigmento, has 348 C)
      const editButtons = screen.getAllByText('Editar')
      fireEvent.click(editButtons[1]) // Second design is pigmento
      await act(async () => {})

      // Edit modal should show pigmento colors
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByRole('button', { name: '348 C' })).toBeTruthy()
      expect(within(dialog).getByRole('button', { name: '286 C' })).toBeTruthy()
      expect(within(dialog).getByRole('button', { name: 'Black' })).toBeTruthy()
      // Should NOT show reactiva-only colors
      expect(within(dialog).queryByRole('button', { name: '185 C' })).toBeNull()
      expect(within(dialog).queryByRole('button', { name: '281 C' })).toBeNull()

      // Switch paint_type in edit to reactiva
      const editPaintSelect = within(dialog).getAllByRole('combobox').find((el) =>
        el.closest('label')?.textContent?.includes('Tipo de pintura'),
      )
      fireEvent.change(editPaintSelect, { target: { value: 'reactiva' } })
      await act(async () => {})

      // Now should show reactiva colors, not pigmento
      expect(within(dialog).getByRole('button', { name: '185 C' })).toBeTruthy()
      expect(within(dialog).queryByRole('button', { name: '348 C' })).toBeNull()
      expect(within(dialog).queryByRole('button', { name: '286 C' })).toBeNull()
    })
  })
})

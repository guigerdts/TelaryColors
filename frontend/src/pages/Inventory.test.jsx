// Inventory page — Spanish UI. Lists inventory items with the binary stock
// status the BACKEND computes (inventory_status: "ok" | "bajo_umbral" from
// InventoryItemOut.from_item / derive_status — design ADR-1/4). The page MUST
// display the served status as-is and NEVER recompute ok/bajo_umbral from
// current_stock vs reorder_threshold in the browser. The form creates/edits
// an item's six tracked fields (name, item_type, unit, supplier, supply_city,
// reorder_threshold); current_stock is intentionally NOT editable there —
// stock only moves through transactions (design ADR-6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import InventoryPage from './Inventory.jsx'

// Fixtures mirror the backend InventoryItemOut contract exactly (schemas.py):
// Decimal serializes as string, inventory_status is served, not derived.
const ITEMS = [
  {
    id: 1,
    name: 'Colorante Amarillo 109',
    item_type: 'colorante',
    unit: 'kg',
    supplier: 'Química Rosario',
    supply_city: 'Rosario',
    current_stock: '12.0000',
    reorder_threshold: '5.0000',
    inventory_status: 'ok',
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 2,
    name: 'Pasta Madre Blanco',
    item_type: 'insumo_pasta_madre',
    unit: 'kg',
    supplier: 'Pinturerías Córdoba',
    supply_city: 'Córdoba',
    current_stock: '2.0000',
    reorder_threshold: '10.0000',
    inventory_status: 'bajo_umbral',
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
]

describe('InventoryPage (list + six-field form)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockClear()
    fetchMock.mockImplementation((url, init) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.includes('/inventory/items') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 3, ...JSON.parse(init.body), inventory_status: 'ok' }),
        })
      }
      if (u.includes('/inventory/items') && method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 1, ...JSON.parse(init.body), inventory_status: 'ok' }),
        })
      }
      // Default: the item list the page loads on mount.
      return Promise.resolve({ ok: true, status: 200, json: async () => ITEMS })
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders every item with the status served by the backend (ok and bajo_umbral)', async () => {
    render(<InventoryPage />)
    await act(async () => {})

    // Both fixture items render on the list.
    expect(screen.getByText('Colorante Amarillo 109')).toBeTruthy()
    expect(screen.getByText('Pasta Madre Blanco')).toBeTruthy()

    // StatusBadge maps raw enum → human label: ok→"OK", bajo_umbral→"Bajo umbral".
    // The ADR-1/4 invariant: the STATUS VALUE is never recomputed client-side.
    const okCard = screen.getByText('Colorante Amarillo 109').closest('li')
    const lowCard = screen.getByText('Pasta Madre Blanco').closest('li')
    expect(within(okCard).getByText('OK')).toBeTruthy()
    expect(within(lowCard).getByText('Bajo umbral')).toBeTruthy()
    expect(within(okCard).queryByText('Bajo umbral')).toBeNull()
    expect(within(lowCard).queryByText('OK')).toBeNull()
  })

  it('shows stock and threshold per item straight from the payload', async () => {
    render(<InventoryPage />)
    await act(async () => {})

    const okCard = screen.getByText('Colorante Amarillo 109').closest('li')
    expect(within(okCard).getByText('12.0000')).toBeTruthy()
    expect(within(okCard).getByText('5.0000')).toBeTruthy()
    const lowCard = screen.getByText('Pasta Madre Blanco').closest('li')
    expect(within(lowCard).getByText('2.0000')).toBeTruthy()
    expect(within(lowCard).getByText('10.0000')).toBeTruthy()
  })

  it('submits a create with the six tracked fields', async () => {
    render(<InventoryPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colorante Verde 301' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'colorante' } })
    fireEvent.change(screen.getByLabelText(/unidad/i), { target: { value: 'kg' } })
    fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'Química Rosario' } })
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'Rosario' } })
    fireEvent.change(screen.getByLabelText(/umbral/i), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /crear/i }))
    await act(async () => {})
    // Confirm in the dialog to complete the create.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/inventory/items'),
    )
    expect(createCall).toBeTruthy()
    const body = JSON.parse(createCall[1].body)
    expect(body.name).toBe('Colorante Verde 301')
    expect(body.item_type).toBe('colorante')
    expect(body.unit).toBe('kg')
    expect(body.supplier).toBe('Química Rosario')
    expect(body.supply_city).toBe('Rosario')
    expect(body.reorder_threshold).toBe(7)
  })

  it('loads an existing item into the form and PATCHes the six editable fields, never stock', async () => {
    render(<InventoryPage />)
    await act(async () => {})

    // Clicking an item loads its values into the form (edit mode).
    fireEvent.click(screen.getByText('Colorante Amarillo 109'))
    await act(async () => {})

    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Colorante Amarillo 109')
    expect(screen.getByLabelText(/tipo/i)).toHaveValue('colorante')
    expect(screen.getByLabelText(/unidad/i)).toHaveValue('kg')
    expect(screen.getByLabelText(/proveedor/i)).toHaveValue('Química Rosario')
    expect(screen.getByLabelText(/ciudad/i)).toHaveValue('Rosario')
    expect(screen.getByLabelText(/umbral/i)).toHaveValue(5)

    fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'Nuevo Proveedor' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await act(async () => {})
    // Confirm in the dialog to complete the update.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/inventory/items/1'),
    )
    expect(patchCall).toBeTruthy()
    const body = JSON.parse(patchCall[1].body)
    expect(body.name).toBe('Colorante Amarillo 109')
    expect(body.item_type).toBe('colorante')
    expect(body.unit).toBe('kg')
    expect(body.supplier).toBe('Nuevo Proveedor')
    expect(body.supply_city).toBe('Rosario')
    expect(body.reorder_threshold).toBe(5)
    // ADR-6: stock only moves through transactions — PATCH never carries it.
    expect(body).not.toHaveProperty('current_stock')
  })
})
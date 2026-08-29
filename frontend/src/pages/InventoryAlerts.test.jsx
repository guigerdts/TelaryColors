// InventoryAlerts page — Spanish UI. Renders the backend's reorder-alert
// groups VERBATIM: GET /inventory/reorder-alerts already groups by
// supply_city + supplier (SQL GROUP BY in slice D) and every item carries its
// served inventory_status (InventoryItemOut / derive_status — design ADR-1/4).
// The page MUST NOT regroup, re-sort, or re-key the served structure, and MUST
// NOT recompute ok/bajo_umbral from current_stock vs reorder_threshold.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'

import InventoryAlertsPage from './InventoryAlerts.jsx'

// Fixtures mirror the backend ReorderAlertGroup contract exactly (schemas.py):
// one group per (supply_city, supplier) with items as InventoryItemOut —
// Decimal serializes as string, inventory_status is served, not derived.
// The last group's item is a DELIBERATE defensive case: the API serves "ok"
// while current_stock is below reorder_threshold, proving the page renders the
// served status verbatim and never recomputes it client-side (ADR-1/4). The
// real endpoint only sends bajo_umbral items.
const GROUPS = [
  {
    supply_city: 'Rosario',
    supplier: 'Química Rosario',
    items: [
      {
        id: 1,
        name: 'Colorante Amarillo 109',
        item_type: 'colorante',
        unit: 'kg',
        supplier: 'Química Rosario',
        supply_city: 'Rosario',
        current_stock: '2.0000',
        reorder_threshold: '5.0000',
        inventory_status: 'bajo_umbral',
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 2,
        name: 'Colorante Rojo 302',
        item_type: 'colorante',
        unit: 'kg',
        supplier: 'Química Rosario',
        supply_city: 'Rosario',
        current_stock: '1.5000',
        reorder_threshold: '5.0000',
        inventory_status: 'bajo_umbral',
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
    ],
  },
  {
    supply_city: 'Córdoba',
    supplier: 'Pinturerías Córdoba',
    items: [
      {
        id: 3,
        name: 'Pasta Madre Blanco',
        item_type: 'insumo_pasta_madre',
        unit: 'kg',
        supplier: 'Pinturerías Córdoba',
        supply_city: 'Córdoba',
        current_stock: '4.0000',
        reorder_threshold: '10.0000',
        inventory_status: 'bajo_umbral',
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
    ],
  },
  {
    supply_city: 'Córdoba',
    supplier: 'Químicos del Norte',
    items: [
      {
        id: 4,
        name: 'Colorante Azul 205',
        item_type: 'colorante',
        unit: 'kg',
        supplier: 'Químicos del Norte',
        supply_city: 'Córdoba',
        current_stock: '2.0000',
        reorder_threshold: '5.0000',
        inventory_status: 'ok',
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
    ],
  },
]

describe('InventoryAlertsPage (grouped reorder alerts)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockClear()
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => GROUPS }),
    )
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the alert groups exactly as the backend serves them: city → supplier → items, in API order', async () => {
    render(<InventoryAlertsPage />)
    await act(async () => {})

    // The page calls the reorder-alerts endpoint on mount.
    const alertCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/inventory/reorder-alerts'),
    )
    expect(alertCall).toBeTruthy()

    // City group headings appear in the SAME order the API returned them
    // (Rosario first, then the two Córdoba groups) — the page must not re-sort.
    const cityHeadings = screen.getAllByRole('heading', { level: 3 })
    expect(cityHeadings.map((h) => h.textContent)).toEqual(['Rosario', 'Córdoba', 'Córdoba'])

    // Rosario has ONE supplier sub-group with both of its items, in API order.
    const rosario = cityHeadings[0].closest('section')
    expect(
      within(rosario).getByRole('heading', { level: 4, name: 'Química Rosario' }),
    ).toBeTruthy()
    const rosarioItems = within(rosario).getAllByRole('listitem')
    expect(rosarioItems.map((li) => li.textContent)).toHaveLength(2)
    expect(rosarioItems[0].textContent).toContain('Colorante Amarillo 109')
    expect(rosarioItems[1].textContent).toContain('Colorante Rojo 302')

    // Córdoba has TWO supplier sub-groups in API order: Pinturerías Córdoba
    // first, then Químicos del Norte, each with its own item.
    const cordoba1 = cityHeadings[1].closest('section')
    const cordoba2 = cityHeadings[2].closest('section')
    expect(
      within(cordoba1).getByRole('heading', { level: 4, name: 'Pinturerías Córdoba' }),
    ).toBeTruthy()
    expect(within(cordoba1).getByText('Pasta Madre Blanco')).toBeTruthy()
    expect(
      within(cordoba2).getByRole('heading', { level: 4, name: 'Químicos del Norte' }),
    ).toBeTruthy()
    expect(within(cordoba2).getByText('Colorante Azul 205')).toBeTruthy()
  })

  it('renders the served inventory_status badge verbatim — never recomputed (ADR-1/4)', async () => {
    render(<InventoryAlertsPage />)
    await act(async () => {})

    // Every alert item shows its served bajo_umbral badge and its stock data.
    const amarillo = screen.getByText('Colorante Amarillo 109').closest('li')
    expect(within(amarillo).getByText('bajo_umbral')).toBeTruthy()
    expect(within(amarillo).getByText(/stock: 2\.0000 kg/i)).toBeTruthy()
    const pasta = screen.getByText('Pasta Madre Blanco').closest('li')
    expect(within(pasta).getByText('bajo_umbral')).toBeTruthy()

    // The deliberate synthetic fixture: stock below threshold served as "ok".
    // The page MUST show whatever the API served and must NOT recompute
    // bajo_umbral from current_stock < reorder_threshold (ADR-1/4).
    const azul = screen.getByText('Colorante Azul 205').closest('li')
    expect(within(azul).getByText('ok')).toBeTruthy()
    expect(within(azul).queryByText('bajo_umbral')).toBeNull()
  })

  it('shows the empty state when nothing is below threshold (no groups)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => [] }),
    )
    render(<InventoryAlertsPage />)
    await act(async () => {})

    expect(screen.getByText('Sin alertas de reposición')).toBeTruthy()
    // And no group headings render at all.
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })
})
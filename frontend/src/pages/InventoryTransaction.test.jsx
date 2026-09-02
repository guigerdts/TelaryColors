// InventoryTransaction — Spanish UI. Mobile-first register of an inventory
// stock movement (entrada / consumo / ajuste). The form collects a POSITIVE
// quantity and the transaction TYPE; the backend applies the ADR-6 signed
// delta (entrada +, consumo/ajuste −). The frontend MUST NOT reinterpret the
// sign — it always sends the raw positive number the operator typed, for every
// type. The formula may be preloaded via `?formula_id=` (auto-preloaded from a
// formula page, spec "Happy-path consumo with formula"); when present the
// formula field is read-only/hidden so it cannot be edited. Backend 400
// messages are surfaced verbatim (design ADR-3) — never a generic error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import InventoryTransactionPage from './InventoryTransaction.jsx'

const FORMULA_UUID = 'a3f1c6a0-0000-4000-8000-000000000001'

// Existing designs offered by the optional consumo design selector (F.4). Only
// these get linked — never free text / inline creation (user confirmation 2).
const DESIGNS = [{ id: 31, name: 'Colección Aromo', client: 'Telary Home', notes: null }]

// Inventory items the form lets the operator pick as the transaction target.
const ITEMS = [
  {
    id: 2,
    name: 'Colorante Amarillo 109',
    item_type: 'colorante',
    unit: 'kg',
    supplier: 'Química Rosario',
    supply_city: 'Rosario',
    current_stock: '12.0000',
    reorder_threshold: '5.0000',
    inventory_status: 'ok',
  },
]

// Render the page at a given URL so `useSearchParams` (react-router v7) sees
// the real query string — this drives the `?formula_id=` prefill contract.
function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/inventario/transaccion" element={<InventoryTransactionPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('InventoryTransactionPage (mobile txn form)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockClear()
    // Default: the item list loads on mount; inventory POSTs succeed (201).
    // Individual tests override the POST branch to assert or to simulate 400s.
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/inventory/items') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ITEMS })
      }
      if (String(url).includes('/transactions')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 1, ...JSON.parse(init.body) }),
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

  it('renders the item, type selector, quantity, notes and a save action on one screen', async () => {
    renderAt('/inventario/transaccion')
    await act(async () => {})

    // The operator picks WHICH inventory item receives this movement.
    expect(screen.getByLabelText(/item/i)).toBeTruthy()
    expect(screen.getByLabelText(/tipo/i)).toBeTruthy()
    expect(screen.getByLabelText(/cantidad/i)).toBeTruthy()
    expect(screen.getByLabelText(/notas/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /registrar/i })).toBeTruthy()
  })

  it.each([
    ['entrada', 'entrada'],
    ['consumo', 'consumo'],
    ['ajuste', 'ajuste'],
  ])('sends a %s to the selected item with the SAME positive quantity the operator typed (no sign reinterpretation)', async (type) => {
    renderAt('/inventario/transaccion')
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: type } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    // Confirmation dialog: the real request runs only after "Guardar" (P1).
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    // The transaction targets the selected item via the path id.
    const call = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/inventory/items/2/transactions'),
    )
    expect(call).toBeTruthy()
    const body = JSON.parse(call[1].body)
    // The payload carries the raw positive number for EVERY type — the backend
    // owns the sign (ADR-6). A `-quantity` or Math.abs would fail this.
    expect(body.transaction_type).toBe(type)
    expect(body.quantity).toBe(5)
  })

  it('stages the transaction behind a confirmation dialog — no POST before confirm (P1)', async () => {
    renderAt('/inventario/transaccion')
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'consumo' } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})

    // The dialog is open and no request has been sent yet.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy()
    const call = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/transactions'),
    )
    expect(call).toBeUndefined()
  })

  it('preloads formula_id from ?formula_id= and renders the formula field read-only', async () => {
    renderAt(`/inventario/transaccion?formula_id=${FORMULA_UUID}`)
    await act(async () => {})

    // The preloaded formula flows through the submit payload.
    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const call = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/transactions'),
    )
    expect(call).toBeTruthy()
    expect(JSON.parse(call[1].body).formula_id).toBe(FORMULA_UUID)

    // The formula field is bound to the prefilled id and is NOT editable.
    const formula = screen.getByLabelText(/fórmula/i)
    expect(formula.value).toBe(FORMULA_UUID)
    expect(formula).toHaveAttribute('disabled')
    expect(formula).not.toHaveAttribute('required')
  })

  it('renders no formula when the URL carries no ?formula_id= — field editable/absent', async () => {
    renderAt('/inventario/transaccion')
    await act(async () => {})

    const formula = screen.queryByLabelText(/fórmula/i)
    // No prefill -> the formula is optional and left for manual entry when the
    // operator wants one; it must not be read-only.
    expect(formula).toBeTruthy()
    expect(formula).not.toHaveAttribute('disabled')
    expect(formula).not.toHaveAttribute('required')
  })

  it('shows the backend negative-stock message verbatim (consumo sin nota)', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/inventory/items') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ITEMS })
      }
      if (String(url).includes('/transactions')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            detail: 'las transacciones que dejan stock negativo requieren una nota',
          }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    renderAt('/inventario/transaccion')
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'consumo' } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    // The exact backend detail string must appear in the UI — NOT a generic error.
    expect(
      screen.getByText('las transacciones que dejan stock negativo requieren una nota'),
    ).toBeTruthy()
  })

  it('shows the backend ajuste-sin-nota message verbatim', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/inventory/items') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ITEMS })
      }
      if (String(url).includes('/transactions')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ detail: 'las transacciones de ajuste requieren una nota' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    renderAt('/inventario/transaccion')
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'ajuste' } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    expect(screen.getByText('las transacciones de ajuste requieren una nota')).toBeTruthy()
  })

  it('omits design_id from the payload when the operator picks no design (consumo sin diseño → no link)', async () => {
    renderAt('/inventario/transaccion')
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'consumo' } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '5' } })
    // The design selector exists but is left unselected — no design_id is sent.
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const call = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/transactions'),
    )
    expect(call).toBeTruthy()
    // Omitting the design MUST NOT silently link anything — no design_id field.
    const body = JSON.parse(call[1].body)
    expect(body).not.toHaveProperty('design_id')
  })

  it('sends design_id when the operator selects an existing design', async () => {
    fetchMock.mockImplementation((url, init) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.includes('/inventory/items') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ITEMS })
      }
      if (u.includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (u.includes('/transactions')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 1, ...JSON.parse(init.body) }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    renderAt('/inventario/transaccion')
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/item/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'consumo' } })
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '5' } })
    const design = screen.getByLabelText(/diseño/i)
    // Only existing designs are offered (the selector is populated from
    // listDesigns — never free text / inline creation).
    expect(within(design).getAllByRole('option').map((o) => o.textContent)).toContain('Colección Aromo')
    fireEvent.change(design, { target: { value: '31' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const call = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/transactions'),
    )
    expect(call).toBeTruthy()
    expect(JSON.parse(call[1].body).design_id).toBe(31)
  })
})

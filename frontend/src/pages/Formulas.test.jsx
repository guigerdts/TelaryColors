import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import FormulasPage from './Formulas.jsx'

vi.mock('../api/index.js', () => ({
  listFormulas: vi.fn(),
  listPantone: vi.fn(),
  createFormula: vi.fn(),
  updateFormula: vi.fn(),
}))

import { listFormulas, listPantone, createFormula, updateFormula } from '../api/index.js'

const renderPage = () =>
  render(
    <MemoryRouter>
      <FormulasPage />
    </MemoryRouter>,
  )

const makeFormula = (overrides) => ({
  id: 1,
  name: 'Fórmula Roja',
  notes: 'Base roja',
  pantone_color_id: 1,
  ingredients: [
    { id: 10, colorant: 'Rojo rubí', quantity_g: '150.0', unit: 'g' },
    { id: 11, colorant: 'Blanco', quantity_g: '850.0', unit: 'g' },
  ],
  ...overrides,
})

const makeFormulaMultiIngredient = () => ({
  id: 2,
  name: 'Fórmula Compleja',
  notes: null,
  pantone_color_id: 2,
  ingredients: [
    { id: 20, colorant: 'Blanco', quantity_g: '500.0', unit: 'g' },
    { id: 21, colorant: 'Rojo rubí', quantity_g: '100.0', unit: 'g' },
    { id: 22, colorant: 'Amarillo', quantity_g: '100.0', unit: 'g' },
    { id: 23, colorant: 'Azul cobalto', quantity_g: '150.0', unit: 'g' },
    { id: 24, colorant: 'Negro', quantity_g: '150.0', unit: 'g' },
  ],
})

describe('FormulasPage', () => {
  beforeEach(() => {
    listFormulas.mockResolvedValue([])
    listPantone.mockResolvedValue([{ id: 1, code: '221', gamut: 'C' }])
    createFormula.mockResolvedValue({ id: 99 })
    updateFormula.mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders formula list with all names', async () => {
    const f1 = makeFormula({ id: 1, name: 'Roja Base' })
    const f2 = makeFormula({ id: 2, name: 'Azul Profunda' })
    listFormulas.mockResolvedValueOnce([f1, f2])

    await act(async () => {
      renderPage()
    })

    expect(screen.getByText('Roja Base')).toBeTruthy()
    expect(screen.getByText('Azul Profunda')).toBeTruthy()
  })

  it('shows empty state when no formulas exist', async () => {
    await act(async () => {
      renderPage()
    })

    expect(screen.getByText('Sin fórmulas creadas')).toBeTruthy()
    expect(screen.getByText(/Crea tu primera fórmula/)).toBeTruthy()
  })

  it('creates a new formula through the full flow', async () => {
    await act(async () => {
      renderPage()
    })

    // Fill form fields — the name input's accessible name is "Nombre *"
    // (from its <label> text). Colorant inputs have aria-label "Nombre del
    // colorante", so regex anchored at start avoids matching both.
    // "Nombre *" vs "Nombre del colorante" — only the formula name has the *
    fireEvent.change(screen.getByRole('textbox', { name: /^Nombre\s\*/ }), { target: { value: 'Nueva Verde' } })
    fireEvent.change(screen.getByLabelText(/Color Pantone/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Notas/), { target: { value: 'Test notes' } })

    // Fill ingredient
    fireEvent.change(screen.getByPlaceholderText('Colorante'), { target: { value: 'Verde palo' } })
    fireEvent.change(screen.getByPlaceholderText('Cantidad'), { target: { value: '200' } })

    // Submit form — use fireEvent.submit on the <form> to bypass native
    // validation (the select might block in jsdom).
    fireEvent.submit(screen.getByRole('button', { name: /Crear fórmula/ }).closest('form'))

    // ConfirmDialog is now open
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Confirmar nueva fórmula')).toBeTruthy()
    expect(within(dialog).getByText('Nueva Verde')).toBeTruthy()

    // Confirm
    await act(async () => {
      fireEvent.click(within(dialog).getByText('Confirmar y guardar'))
    })

    expect(createFormula).toHaveBeenCalledTimes(1)
    const payload = createFormula.mock.calls[0][0]
    expect(payload.name).toBe('Nueva Verde')
    expect(payload.pantone_color_id).toBe(1)
    expect(payload.ingredients).toEqual([
      { colorant: 'Verde palo', quantity: '200', unit: 'g' },
    ])

    // Success message shown
    expect(screen.getByText('Fórmula creada')).toBeTruthy()
  })

  it('edits an existing formula through the full flow', async () => {
    const formula = makeFormula()
    listFormulas.mockResolvedValueOnce([formula])

    await act(async () => {
      renderPage()
    })

    // Click "Editar" on the formula
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/editar Fórmula Roja/))
    })

    // Form should be pre-filled
    expect(screen.getByText(/Editar fórmula Fórmula Roja/)).toBeTruthy()

    // Change the name — same selector pattern as create
    fireEvent.change(screen.getByRole('textbox', { name: /^Nombre\s\*/ }), { target: { value: 'Roja Actualizada' } })

    // Submit — opens ConfirmDialog in edit mode
    fireEvent.submit(screen.getByRole('button', { name: /Guardar/ }).closest('form'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Guardar cambios')).toBeTruthy()

    // Confirm
    await act(async () => {
      fireEvent.click(within(dialog).getByText('Confirmar y guardar'))
    })

    expect(updateFormula).toHaveBeenCalledTimes(1)
    const [id, payload] = updateFormula.mock.calls[0]
    expect(id).toBe(formula.id)
    expect(payload.name).toBe('Roja Actualizada')
    expect(payload.ingredients).toEqual([
      { id: 10, quantity: '150.0' },
      { id: 11, quantity: '850.0' },
    ])
  })

  it('adds and removes ingredient rows', async () => {
    await act(async () => {
      renderPage()
    })

    // Initially there is one ingredient row (empty)
    const addBtn = screen.getByText('+ Agregar ingrediente')
    expect(addBtn).toBeTruthy()

    // Count initial inputs — one colorant + one quantity = 2
    const initialIngredients = screen.getAllByPlaceholderText('Colorante')
    expect(initialIngredients).toHaveLength(1)

    // Add a new ingredient
    fireEvent.click(addBtn)
    const afterAdd = screen.getAllByPlaceholderText('Colorante')
    expect(afterAdd).toHaveLength(2)

    // Add another
    fireEvent.click(addBtn)
    const afterSecondAdd = screen.getAllByPlaceholderText('Colorante')
    expect(afterSecondAdd).toHaveLength(3)

    // Remove the first ingredient by clicking its "Quitar"
    const removeButtons = screen.getAllByText('Quitar')
    fireEvent.click(removeButtons[0])

    const afterRemove = screen.getAllByPlaceholderText('Colorante')
    expect(afterRemove).toHaveLength(2)
  })
})

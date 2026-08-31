// Formulas page — tests for create, edit, and confirmation modal flow.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import FormulasPage from './Formulas.jsx'
import * as api from '../api/index.js'

vi.mock('../api/index.js', () => ({
  listFormulas: vi.fn(),
  createFormula: vi.fn(),
  updateFormula: vi.fn(),
  listPantone: vi.fn(),
}))

const FORMULA = {
  id: 1,
  name: 'Fórmula Azul',
  pantone_color_id: 1,
  notes: 'Notas de prueba',
  ingredients: [
    { id: 10, colorant: 'Azul', quantity_g: 50, unit: 'g' },
    { id: 11, colorant: 'Blanco', quantity_g: 100, unit: 'g' },
  ],
}

const COLORS = [{ id: 1, code: '211', gamut: 'C', paint_type: 'reactiva' }]

const renderPage = () =>
  render(
    <MemoryRouter>
      <FormulasPage />
    </MemoryRouter>,
  )

describe('FormulasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFormulas.mockResolvedValue([FORMULA])
    api.listPantone.mockResolvedValue(COLORS)
    api.createFormula.mockResolvedValue({})
    api.updateFormula.mockResolvedValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the create form and lists formulas', async () => {
    renderPage()
    await act(async () => {})

    expect(screen.getByText('Fórmula Azul')).toBeTruthy()
    expect(screen.getByText(/Azul: 50 g/)).toBeTruthy()
    expect(screen.getByText(/Blanco: 100 g/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /crear fórmula/i })).toBeTruthy()
  })

  it('create flow shows confirmation modal and only calls createFormula after confirm', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nueva Fórmula' } })
    fireEvent.change(screen.getByLabelText(/color pantone/i), { target: { value: '1' } })
    fireEvent.change(screen.getByPlaceholderText(/colorante/i), { target: { value: 'Rojo' } })
    fireEvent.change(screen.getByPlaceholderText(/cantidad/i), { target: { value: '25' } })

    // Click submit — opens modal, does NOT call API yet
    fireEvent.click(screen.getByRole('button', { name: /crear fórmula/i }))
    await act(async () => {})

    expect(screen.getByText('Confirmar y guardar')).toBeTruthy()
    expect(screen.getByText('Volver a revisar')).toBeTruthy()
    expect(api.createFormula).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirmar y guardar'))
    await act(async () => {})

    expect(api.createFormula).toHaveBeenCalledTimes(1)
    const payload = api.createFormula.mock.calls[0][0]
    expect(payload.name).toBe('Nueva Fórmula')
    expect(payload.ingredients).toEqual([{ colorant: 'Rojo', quantity: '25', unit: 'g' }])
    expect(screen.getByText('Fórmula creada')).toBeTruthy()
  })

  it('"Volver a revisar" closes the modal without saving', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText(/color pantone/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /crear fórmula/i }))
    await act(async () => {})

    expect(screen.getByText('Volver a revisar')).toBeTruthy()
    fireEvent.click(screen.getByText('Volver a revisar'))
    await act(async () => {})

    expect(screen.queryByText('Volver a revisar')).toBeNull()
    expect(api.createFormula).not.toHaveBeenCalled()
  })

  it('edit mode loads formula into form with read-only structure', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: /editar fórmula azul/i }))
    await act(async () => {})

    // Form populated with formula data
    expect(screen.getByLabelText(/nombre/i).value).toBe('Fórmula Azul')
    expect(screen.getByLabelText(/color pantone/i).value).toBe('1')
    expect(screen.getByLabelText(/notas/i).value).toBe('Notas de prueba')

    // Colorant inputs are readOnly
    const colorantInputs = screen.getAllByPlaceholderText(/colorante/i)
    colorantInputs.forEach((input) => {
      expect(input.readOnly || input.disabled).toBe(true)
    })

    // No add/remove ingredient buttons
    expect(screen.queryByText(/\+ Agregar ingrediente/)).toBeNull()
    expect(screen.queryByText('Quitar')).toBeNull()

    // Submit label switches to "Guardar" and header shows edit mode
    expect(screen.getByRole('button', { name: /guardar/i })).toBeTruthy()
    expect(screen.getByText(/editar fórmula/i)).toBeTruthy()
  })

  it('edit save calls updateFormula with {id, quantity} only', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: /editar fórmula azul/i }))
    await act(async () => {})

    // Change first ingredient quantity
    const quantityInputs = screen.getAllByPlaceholderText(/cantidad/i)
    fireEvent.change(quantityInputs[0], { target: { value: '75' } })

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await act(async () => {})

    fireEvent.click(screen.getByText('Confirmar y guardar'))
    await act(async () => {})

    expect(api.updateFormula).toHaveBeenCalledTimes(1)
    const [id, payload] = api.updateFormula.mock.calls[0]
    expect(id).toBe(1)
    expect(payload).toEqual({
      name: 'Fórmula Azul',
      notes: 'Notas de prueba',
      ingredients: [
        { id: 10, quantity: '75' },
        { id: 11, quantity: 100 },
      ],
    })

    // Edit mode exits — submit label returns to "Crear fórmula"
    expect(screen.getByRole('button', { name: /crear fórmula/i })).toBeTruthy()
    expect(screen.getByText('Cambios guardados')).toBeTruthy()
  })

  it('confirmation modal is an ARIA dialog: labelled title, Escape close, focus restore', async () => {
    renderPage()
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'A11y' } })
    fireEvent.change(screen.getByLabelText(/color pantone/i), { target: { value: '1' } })
    const createBtn = screen.getByRole('button', { name: /crear fórmula/i })
    createBtn.focus()
    fireEvent.click(createBtn)
    await act(async () => {})

    const dialog = screen.getByRole('dialog')
    // aria-labelledby points at the dialog's title element.
    const title = dialog.querySelector('h3')
    expect(title).toBeTruthy()
    expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // Focus moved into the dialog so the trap has a start point.
    expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true)

    // Escape closes the dialog without saving.
    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.createFormula).not.toHaveBeenCalled()
    // Focus was restored to the element that opened the dialog.
    expect(document.activeElement).toBe(createBtn)
  })
})

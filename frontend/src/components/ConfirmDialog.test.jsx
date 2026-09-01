// ConfirmDialog — shared accessible ARIA dialog for confirmation prompts.
// Covers: title, description, confirm/cancel, Escape close, focus trap, and
// focus restoration to the element that triggered the dialog.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import ConfirmDialog from './ConfirmDialog.jsx'

const DEFAULTS = {
  title: '¿Eliminar?',
  description: 'Esta acción no se puede deshacer.',
  confirmLabel: 'Eliminar',
  cancelLabel: 'Cancelar',
}

const renderOpen = (overrides = {}) => {
  const result = render(
    <ConfirmDialog
      open
      onConfirm={vi.fn()}
      onClose={vi.fn()}
      {...DEFAULTS}
      {...overrides}
    />,
  )
  return result
}

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    render(<ConfirmDialog open={false} onConfirm={vi.fn()} onClose={vi.fn()} {...DEFAULTS} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders title, description and action labels when open', () => {
    renderOpen()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('heading', { name: /eliminar\?/i })).toBeTruthy()
    expect(screen.getByText(/no se puede deshacer/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeTruthy()
  })

  it('aria-labelledby points at the title element and aria-modal is true', () => {
    renderOpen()
    const dialog = screen.getByRole('dialog')
    const title = screen.getByRole('heading', { name: /eliminar\?/i })
    expect(dialog).toHaveAttribute('aria-labelledby', title.id)
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    renderOpen({ onConfirm })
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn()
    renderOpen({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key calls onClose and restores focus to the trigger', async () => {
    const onClose = vi.fn()
    const next = (
      <ConfirmDialog open onClose={onClose} onConfirm={vi.fn()} {...DEFAULTS} />
    )
    const closed = (
      <ConfirmDialog open={false} onClose={onClose} onConfirm={vi.fn()} {...DEFAULTS} />
    )
    const { rerender } = render(
      <>
        <button type="button" data-testid="trigger">Abrir</button>
        {closed}
      </>,
    )
    // Focus the trigger BEFORE the dialog opens, as a real click would.
    const trigger = screen.getByTestId('trigger')
    trigger.focus()
    await act(async () => {})

    // Now open the dialog — the effect records the currently-focused trigger.
    rerender(
      <>
        <button type="button" data-testid="trigger">Abrir</button>
        {next}
      </>,
    )
    await act(async () => {})

    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () => {})
    expect(onClose).toHaveBeenCalledTimes(1)

    // Real callers close by flipping open to false; that cleanup restores focus.
    rerender(
      <>
        <button type="button" data-testid="trigger">Abrir</button>
        {closed}
      </>,
    )
    await act(async () => {})

    // Focus returned to the element that was focused before the dialog opened.
    expect(document.activeElement).toBe(trigger)
  })

  it('Tab wraps within the dialog (focus trap)', async () => {
    renderOpen()
    const dialog = screen.getByRole('dialog')
    const buttons = screen.getAllByRole('button')
    const cancelBtn = buttons.find((b) => /cancelar/i.test(b.textContent))
    const confirmBtn = buttons.find((b) => /eliminar/i.test(b.textContent))

    // Tab to the last focusable (confirm), then Tab again — should wrap to first (cancel).
    cancelBtn.focus()
    fireEvent.keyDown(document.activeElement, { key: 'Tab' })
    await act(async () => {})
    expect(document.activeElement).toBe(confirmBtn)

    // Shift+Tab from confirm should wrap to cancel.
    fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true })
    await act(async () => {})
    expect(document.activeElement).toBe(cancelBtn)
  })
})

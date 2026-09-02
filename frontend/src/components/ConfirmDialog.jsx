// ConfirmDialog — shared, accessible ARIA confirmation dialog (Spanish UI).
// Extracted from the Fórmulas confirmation modal so every destructive action
// (delete a Pantone, promote a sample, change a role) reuses the same focus
// trap, Escape-to-close, labelled title, and focus restoration instead of
// duplicating the ARIA logic per caller.
//
// Opera mode motion: overlay fade + panel rise (animate-overlay-in /
// animate-panel-in), both suppressed by the global prefers-reduced-motion guard.
import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onClose,
  busy = false,
  danger = false,
  children,
}) {
  const dialogRef = useRef(null)
  const titleId = useRef(`confirm-dialog-${Math.random().toString(36).slice(2, 9)}`).current
  const lastFocusedRef = useRef(null)

  // While open: record who opened us, focus the dialog, trap Tab, close on
  // Escape, and restore focus to the opener on close (ARIA dialog pattern).
  useEffect(() => {
    if (!open) return
    lastFocusedRef.current = document.activeElement
    const dialog = dialogRef.current
    dialog?.focus?.()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      // Focus trap: keep Tab wrapped within the dialog's focusable elements.
      // Move focus explicitly in both directions so the trap is deterministic
      // (it must not rely on a browser default that jsdom does not implement).
      const focusable = Array.from(
        dialog?.querySelectorAll?.(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusable.length === 0) return
      const currentIndex = focusable.indexOf(document.activeElement)
      if (event.shiftKey) {
        event.preventDefault()
        if (currentIndex <= 0) focusable[focusable.length - 1].focus()
        else focusable[currentIndex - 1].focus()
      } else {
        event.preventDefault()
        if (currentIndex === -1 || currentIndex >= focusable.length - 1) focusable[0].focus()
        else focusable[currentIndex + 1].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      lastFocusedRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 outline-none animate-overlay-in sm:items-center"
    >
      <div className="w-full max-w-md rounded-lg bg-surface-raised p-5 shadow-xl animate-panel-in">
        <h3 id={titleId} className="text-lg font-semibold text-text-primary">
          {title}
        </h3>
        {description && <p className="mt-2 text-sm text-text-secondary">{description}</p>}
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded bg-neutral-300 px-4 py-2 text-sm font-semibold text-text-primary hover:bg-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded px-4 py-2 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 ${
              danger ? 'bg-error-text' : 'bg-accent-281c'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

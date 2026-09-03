// InventoryTransaction — Spanish UI. Mobile-first register of a stock movement
// (entrada / consumo / ajuste) on a chosen inventory item. The form collects a
// POSITIVE quantity and the transaction TYPE; the backend applies the ADR-6
// signed delta (entrada +, consumo/ajuste −). The frontend MUST NOT reinterpret
// the sign — the raw positive number the operator typed is sent for every type.
// When reached from a formula card the `?formula_id=` query param preloads the
// formula as a READ-ONLY field (the consumption is tied to that production, spec
// "Happy-path consumo with formula"); without the param the field stays optional
// and editable. Backend 400 `detail` messages are shown verbatim (design ADR-3).
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { listDesigns, listInventoryItems, registerInventoryTransaction } from '../api/index.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function InventoryTransactionPage() {
  const [searchParams] = useSearchParams()
  // Prefilled from the formula card NavLink; read-only so it cannot be edited.
  const prefilledFormulaId = searchParams.get('formula_id') || ''

  const [items, setItems] = useState([])
  const [itemId, setItemId] = useState('')
  const [transactionType, setTransactionType] = useState('entrada')
  const [quantity, setQuantity] = useState('')
  const [formulaId, setFormulaId] = useState(prefilledFormulaId)
  const [designId, setDesignId] = useState('')
  const [designs, setDesigns] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  // Staged but not yet confirmed submit.
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    let cancelled = false
    listInventoryItems()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {
        /* the item list is loaded best-effort on mount */
      })
    // The optional consumption target design. Only EXISTING designs are offered
    // (listDesigns) — the operator links an existing production order but can
    // never create one inline from this form.
    listDesigns()
      .then((data) => {
        if (!cancelled) setDesigns(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        /* the design list is loaded best-effort on mount */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Submit stages the confirmation dialog; the real API call runs only after
  // the operator confirms (same pattern as Formulas.jsx).
  const onSave = (event) => {
    event.preventDefault()
    if (!itemId) return
    setMessage(null)
    setError(null)
    setPendingSubmit(true)
  }

  // Runs after the operator confirms in the dialog — executes the API call.
  const confirmSave = async () => {
    setMessage(null)
    setError(null)
    setSaving(true)
    try {
      // POSITIVE quantity always — no sign reinterpretation for any type. The
      // backend decides the direction from transaction_type (ADR-6).
      await registerInventoryTransaction(itemId, {
        transaction_type: transactionType,
        quantity: Number(quantity),
        formula_id: formulaId ? formulaId : undefined,
        // Optional: links the movement to an existing design ONLY when the
        // operator picks one; omitting the design sends no design_id (no link).
        design_id: designId ? Number(designId) : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      })
      setMessage('Transacción registrada')
      setItemId('')
      setQuantity('')
      setFormulaId(prefilledFormulaId)
      setDesignId('')
      setNotes('')
      setTransactionType('entrada')
    } catch (err) {
      // The api client throws with the backend's exact Spanish `detail` (e.g.
      // "las transacciones que dejan stock negativo requieren una nota") — show
      // it verbatim, never a generic error.
      setError(err.message)
    } finally {
      setSaving(false)
      setPendingSubmit(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h2 className="text-xl font-bold text-text-primary">Registrar transacción</h2>

      {message && (
        <p role="status" aria-live="polite" className="rounded bg-success-bg px-3 py-2 text-sm text-success-text">{message}</p>
      )}
      {error && <p role="alert" className="rounded bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

      <form onSubmit={onSave} className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-5 shadow-xs">
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-text-secondary">Item</span>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            required
            className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="">Seleccionar…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-text-secondary">Tipo</span>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="entrada">Entrada</option>
            <option value="consumo">Consumo</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-text-secondary">Cantidad</span>
          <input
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </label>

        <div>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-text-secondary">Fórmula</span>
            <input
              value={formulaId}
              onChange={(e) => setFormulaId(e.target.value)}
              // Prefilled from ?formula_id= -> read-only so the production link
              // cannot be edited; otherwise optional manual entry.
              disabled={Boolean(prefilledFormulaId)}
              aria-describedby={prefilledFormulaId ? 'formula-field-hint' : undefined}
              placeholder="Opcional"
              className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-surface-sunken disabled:text-text-disabled"
            />
          </label>
          {prefilledFormulaId && (
            <p id="formula-field-hint" className="mt-1 text-xs text-text-secondary">
              Fórmula prefijada desde la ficha — no editable
            </p>
          )}
        </div>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-text-secondary">Diseño</span>
          <select
            value={designId}
            onChange={(e) => setDesignId(e.target.value)}
            className="w-full rounded border border-border-strong px-3 py-2 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="">Sin diseño</option>
            {designs.map((design) => (
              <option key={design.id} value={design.id}>
                {design.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-text-secondary">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </label>

        <button
          type="submit"
          disabled={!itemId || saving}
          className="min-h-[44px] w-full rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-text-inverse hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Registrar transacción'}
        </button>
      </form>

      <ConfirmDialog
        open={pendingSubmit}
        title="Registrar transacción"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        busy={saving}
        onConfirm={confirmSave}
        onClose={() => setPendingSubmit(false)}
      >
        <p className="mt-3 text-sm text-text-secondary">
          ¿Estás seguro de que quieres registrar esta transacción?
        </p>
      </ConfirmDialog>
    </div>
  )
}

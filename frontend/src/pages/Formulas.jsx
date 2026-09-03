// Formulas page — Spanish UI. Lists formulas with their nested ingredients
// (gram-normalized), lets an operator create a new formula for a color, and
// edit an existing formula's name/notes/ingredient quantities. A confirmation
// modal (pendingSubmit) stages BOTH create and edit before the API call.
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { createFormula, listFormulas, listPantone, updateFormula } from '../api/index.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

const emptyIngredient = { colorant: '', quantity: '', unit: 'g' }

const clearForm = (setters) => {
  setters.setName('')
  setters.setNotes('')
  setters.setPantoneColorId('')
  setters.setIngredients([emptyIngredient])
}

export default function FormulasPage() {
  const [formulas, setFormulas] = useState([])
  const [colors, setColors] = useState([])
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [pantoneColorId, setPantoneColorId] = useState('')
  const [ingredients, setIngredients] = useState([emptyIngredient])
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  // null = create mode; a formula id = editing that formula.
  const [editingId, setEditingId] = useState(null)
  // Staged but not yet confirmed submit ('create' | 'edit' | null).
  const [pendingSubmit, setPendingSubmit] = useState(null)

  const refresh = () => {
    listFormulas().then(setFormulas).catch((err) => setError(err.message))
  }

  useEffect(() => {
    listPantone().then(setColors).catch(() => {})
    refresh()
  }, [])

  const setIngredient = (index, field, value) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)))
  }

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient])
  const removeIngredient = (index) =>
    setIngredients((prev) => prev.filter((_, i) => i !== index))

  // Load an existing formula into the form for editing. The list objects
  // already carry nested ingredients (id/colorant/quantity_g/unit) plus
  // name/notes/pantone_color_id, so no extra fetch is needed here.
  const onEdit = (formula) => {
    setEditingId(formula.id)
    setMessage(null)
    setError(null)
    setName(formula.name)
    setNotes(formula.notes || '')
    setPantoneColorId(String(formula.pantone_color_id))
    setIngredients(
      formula.ingredients.map((ing) => ({
        id: ing.id,
        colorant: ing.colorant,
        quantity: ing.quantity_g,
        unit: ing.unit,
      })),
    )
  }

  // Return to create mode and clear the form.
  const onCancelEdit = () => {
    setEditingId(null)
    setMessage(null)
    setError(null)
    clearForm({ setName, setNotes, setPantoneColorId, setIngredients })
  }

  // Build the payload for the mode currently active.
  const buildPayload = () => {
    if (editingId !== null) {
      // Edit sends only mutable fields: name, notes and ingredient {id, quantity}.
      return {
        name,
        notes: notes || null,
        ingredients: ingredients.map((ing) => ({ id: ing.id, quantity: ing.quantity })),
      }
    }
    return {
      name,
      notes: notes || null,
      pantone_color_id: Number(pantoneColorId),
      ingredients: ingredients
        .filter((ing) => ing.colorant.trim())
        .map((ing) => ({ colorant: ing.colorant, quantity: ing.quantity, unit: ing.unit })),
    }
  }

  // Submit stages the confirmation modal; the real request only runs after
  // the operator confirms (both create and edit share this flow).
  const onSubmit = (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setPendingSubmit(editingId !== null ? 'edit' : 'create')
  }

  // Confirm in the modal: execute the real create/update request.
  const confirmSave = async () => {
    setMessage(null)
    setError(null)
    try {
      if (pendingSubmit === 'edit') {
        await updateFormula(editingId, buildPayload())
        setMessage('Cambios guardados')
        setEditingId(null)
        clearForm({ setName, setNotes, setPantoneColorId, setIngredients })
      } else {
        await createFormula(buildPayload())
        setMessage('Fórmula creada')
        clearForm({ setName, setNotes, setPantoneColorId, setIngredients })
      }
      setPendingSubmit(null)
      refresh()
    } catch (err) {
      // On 422/error keep the form filled so the operator can adjust without
      // data loss.
      setError(err.message)
      setPendingSubmit(null)
    }
  }

  const matchingColor = () => colors.find((c) => String(c.id) === String(pantoneColorId))

  // Refs for formula cards so we can scroll the edited one into view.
  const formulaRefs = useRef({})

  // When editingId changes, scroll the target card into view.
  useEffect(() => {
    if (editingId !== null && formulaRefs.current[editingId]) {
      formulaRefs.current[editingId]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }
  }, [editingId])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-text-primary">Fórmulas</h1>
        {formulas.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-secondary tabular-nums">
            {formulas.length}
          </span>
        )}
      </div>

      {/* ── Success / Error messages ────────────────────────────────────── */}
      {message && (
        <div role="status" className="rounded-lg bg-success-bg px-4 py-3 text-sm font-medium text-success-text">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg bg-error-bg px-4 py-3 text-sm font-medium text-error-text">
          {error}
        </div>
      )}

      {/* ── Create / Edit form ──────────────────────────────────────────── */}
      <form onSubmit={onSubmit} className="rounded-lg border border-border-default bg-surface-raised p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-text-primary">
          {editingId !== null ? `Editar fórmula ${name}` : 'Nueva fórmula'}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wider text-text-muted">
              Nombre <span className="text-error-text">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wider text-text-muted">
              Color Pantone <span className="text-error-text">*</span>
            </span>
            <select
              value={pantoneColorId}
              onChange={(e) => setPantoneColorId(e.target.value)}
              required
              className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">Seleccionar…</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wider text-text-muted">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </label>

        {/* ── Ingredients ────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Ingredientes
          </span>
          {ingredients.map((ing, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded border border-border-default bg-surface-sunken p-3 sm:flex-row sm:items-center"
            >
              <input
                value={ing.colorant}
                onChange={(e) => setIngredient(index, 'colorant', e.target.value)}
                placeholder="Colorante"
                aria-label="Nombre del colorante"
                readOnly={editingId !== null}
                disabled={editingId !== null}
                className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:flex-1 disabled:bg-surface-sunken disabled:text-text-disabled"
              />
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={ing.quantity}
                  onChange={(e) => setIngredient(index, 'quantity', e.target.value)}
                  placeholder="Cantidad"
                  aria-label="Cantidad en gramos"
                  type="number"
                  step="any"
                  min="0"
                  className="w-24 rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary tabular-nums focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-28"
                />
                <select
                  value={ing.unit}
                  onChange={(e) => setIngredient(index, 'unit', e.target.value)}
                  disabled={editingId !== null}
                  aria-label="Unidad de medida"
                  className="rounded border border-border-strong bg-surface-raised px-2 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-surface-sunken disabled:text-text-disabled"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
                {editingId === null && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="text-xs text-error-text hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}
          {editingId === null && (
            <button
              type="button"
              onClick={addIngredient}
              className="min-h-[44px] text-sm text-primary-500 hover:text-primary-600 hover:underline"
            >
              + Agregar ingrediente
            </button>
          )}
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            className="min-h-[44px] rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-primary-600"
          >
            {editingId !== null ? 'Guardar' : 'Crear fórmula'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="min-h-[44px] rounded border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-sunken"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* ── Formula list ────────────────────────────────────────────────── */}
      {formulas.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {formulas.map((formula) => {
            const match = colors.find((c) => String(c.id) === String(formula.pantone_color_id))
            return (
              <li
                key={formula.id}
                ref={(el) => { formulaRefs.current[formula.id] = el }}
                className={`rounded-lg border bg-surface-raised p-4 shadow-xs transition-shadow hover:shadow-md ${
                  editingId === formula.id
                    ? 'border-border-focus ring-2 ring-primary-500/30 ring-offset-2'
                    : 'border-border-default'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{formula.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {match?.hex_color && (
                        <span
                          aria-label={`Color ${match.code}`}
                          className="inline-block h-4 w-4 shrink-0 rounded border border-border-default"
                          style={{ backgroundColor: match.hex_color }}
                        />
                      )}
                      <span className="truncate text-xs text-text-secondary">
                        {match ? `PMS ${match.code} ${match.gamut ?? ''}`.trim() : `Color #${formula.pantone_color_id}`}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`editar ${formula.name}`}
                    onClick={() => onEdit(formula)}
                    className="shrink-0 rounded px-3 py-1.5 text-xs font-medium text-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                  >
                    Editar
                  </button>
                </div>

                {formula.notes && (
                  <p className="mt-1.5 text-xs text-text-muted">{formula.notes}</p>
                )}

                {/* Ingredient count + compact list */}
                <div className="mt-2 space-y-0.5">
                  {formula.ingredients.slice(0, 3).map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between gap-2 text-xs text-text-secondary">
                      <span className="truncate">{ing.colorant}</span>
                      <span className="shrink-0 whitespace-nowrap font-medium text-text-primary tabular-nums">
                        {Number(ing.quantity_g)} g
                      </span>
                    </div>
                  ))}
                  {formula.ingredients.length > 3 && (
                    <p className="text-xs text-text-muted">
                      + {formula.ingredients.length - 3} ingredientes más
                    </p>
                  )}
                </div>

                {/* Register a consumption tied to this production */}
                <NavLink
                  to={`/inventario/transaccion?formula_id=${formula.id}`}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded text-xs font-medium text-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                >
                  Registrar consumo →
                </NavLink>
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {formulas.length === 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-10 text-center shadow-xs">
          <p className="text-sm font-medium text-text-secondary">Sin fórmulas creadas</p>
          <p className="mt-1 text-xs text-text-muted">Crea tu primera fórmula para comenzar.</p>
        </div>
      )}

      {/* ── Confirm dialog ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!pendingSubmit}
        title={pendingSubmit === 'edit' ? 'Guardar cambios' : 'Confirmar nueva fórmula'}
        confirmLabel="Confirmar y guardar"
        cancelLabel="Volver a revisar"
        onConfirm={confirmSave}
        onClose={() => setPendingSubmit(null)}
      >
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-text-secondary">Nombre</dt>
            <dd className="text-text-primary">{name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-text-secondary">Color Pantone</dt>
            <dd className="text-text-primary">{matchingColor()?.code || `#${pantoneColorId}`}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-text-secondary">Notas</dt>
            <dd className="text-text-primary">{notes || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-text-secondary">Ingredientes</dt>
            <dd className="text-text-primary">
              <ul className="space-y-1">
                {ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.colorant}: {ing.quantity} {ing.unit || 'g'}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </ConfirmDialog>
    </div>
  )
}

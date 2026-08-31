// Formulas page — Spanish UI. Lists formulas with their nested ingredients
// (gram-normalized), lets an operator create a new formula for a color, and
// edit an existing formula's name/notes/ingredient quantities. A confirmation
// modal (pendingSubmit) stages BOTH create and edit before the API call.
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { createFormula, listFormulas, listPantone, updateFormula } from '../api/index.js'

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

  // Accessible confirmation dialog: trap focus while open, close on Escape, and
  // restore focus to whatever opened it when it closes (ARIA dialog pattern).
  const modalRef = useRef(null)
  const modalTitleId = 'formula-confirm-title'
  const lastFocusedRef = useRef(null)

  useEffect(() => {
    if (!pendingSubmit) return
    lastFocusedRef.current = document.activeElement
    const dialog = modalRef.current
    // Focus the dialog itself so the trap has a deterministic start point.
    dialog?.focus?.()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPendingSubmit(null)
        return
      }
      if (event.key !== 'Tab') return
      // Focus trap: keep Tab wrapped within the dialog's focusable elements.
      const focusable = dialog?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      lastFocusedRef.current?.focus?.()
    }
  }, [pendingSubmit])

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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Fórmulas</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-700">
          {editingId !== null ? `Editar fórmula ${name}` : 'Nueva fórmula'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Nombre *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Color Pantone *</span>
            <select
              value={pantoneColorId}
              onChange={(e) => setPantoneColorId(e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            >
              <option value="">Seleccionar…</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-600">Ingredientes</span>
          {ingredients.map((ing, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center"
            >
              <input
                value={ing.colorant}
                onChange={(e) => setIngredient(index, 'colorant', e.target.value)}
                placeholder="Colorante"
                readOnly={editingId !== null}
                disabled={editingId !== null}
                className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30 sm:flex-1 disabled:bg-slate-100"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={ing.quantity}
                  onChange={(e) => setIngredient(index, 'quantity', e.target.value)}
                  placeholder="Cantidad"
                  type="number"
                  step="any"
                  min="0"
                  className="w-24 rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30 sm:w-28"
                />
                <select
                  value={ing.unit}
                  onChange={(e) => setIngredient(index, 'unit', e.target.value)}
                  disabled={editingId !== null}
                  className="rounded border border-slate-300 px-2 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30 disabled:bg-slate-100"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
                {editingId === null && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="text-xs text-red-600 hover:underline"
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
              className="text-sm text-accent-281c hover:underline"
            >
              + Agregar ingrediente
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90"
          >
            {editingId !== null ? 'Guardar' : 'Crear fórmula'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {formulas.map((formula) => (
          <li key={formula.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-800">{formula.name}</p>
              <button
                type="button"
                aria-label={`editar ${formula.name}`}
                onClick={() => onEdit(formula)}
                className="rounded bg-accent-281c px-2 py-1 text-xs font-semibold text-white opacity-90 hover:brightness-90"
              >
                Editar
              </button>
            </div>
            <p className="text-xs text-slate-500">Color #{formula.pantone_color_id}</p>
            {formula.notes && <p className="mt-1 text-sm text-slate-600">{formula.notes}</p>}
            <ul className="ml-4 mt-2 list-disc text-xs text-slate-500">
              {formula.ingredients.map((ing) => (
                <li key={ing.id}>
                  {ing.colorant}: {ing.quantity_g} g
                </li>
              ))}
            </ul>
            {/* Register a consumption tied to this production: the txn form
                auto-preloads formula_id via ?formula_id= (spec "Happy-path
                consumo with formula"; design ?formula_id= mechanism). */}
            <NavLink
              to={`/inventario/transaccion?formula_id=${formula.id}`}
              className="mt-2 inline-block text-sm font-medium text-accent-281c hover:underline"
            >
              Registrar consumo
            </NavLink>
          </li>
        ))}
      </ul>

      {pendingSubmit && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 outline-none animate-overlay-in sm:items-center"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl animate-panel-in">
            <h3 id={modalTitleId} className="text-lg font-semibold text-slate-800">
              {pendingSubmit === 'edit' ? 'Guardar cambios' : 'Confirmar nueva fórmula'}
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">Nombre</dt>
                <dd className="text-slate-800">{name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">Color Pantone</dt>
                <dd className="text-slate-800">{matchingColor()?.code || `#${pantoneColorId}`}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">Notas</dt>
                <dd className="text-slate-800">{notes || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-500">Ingredientes</dt>
                <dd className="text-slate-800">
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
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingSubmit(null)}
                className="rounded bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-400"
              >
                Volver a revisar
              </button>
              <button
                type="button"
                onClick={confirmSave}
                className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90"
              >
                Confirmar y guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

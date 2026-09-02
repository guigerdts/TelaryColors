// Pantone colors page — Spanish UI. CRUD over /pantone-colors. The catalog
// renders as PantoneCards (Slice F) instead of the legacy Fase 1 table, and
// the create form's gamut selector offers the real options C/TPX/U (validated,
// never free text — pantone-card spec "Gamut Selector").
import { useCallback, useEffect, useState } from 'react'

import { createPantone, deletePantone, listPantone, suggestPantoneHex, updatePantone } from '../api/index.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import PantoneCard from '../components/PantoneCard.jsx'
import { useDebounce } from '../hooks/useDebounce.js'
import { GAMUT_OPTIONS, isValidGamut } from '../lib/gamut.js'

export default function PantonePage() {
  const [colors, setColors] = useState([])
  const [code, setCode] = useState('')
  const [gamut, setGamut] = useState('C')
  const [paintType, setPaintType] = useState('reactiva')
  const [hex, setHex] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  // null = creating a new color; a number = editing that color's id.
  const [editingId, setEditingId] = useState(null)
  // A color awaiting destructive-action confirmation, or null when idle.
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  // true once create/edit is staged but not yet confirmed.
  const [pendingSubmit, setPendingSubmit] = useState(false)

  const refresh = useCallback(() => {
    listPantone()
      .then(setColors)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-suggest hex when the code settles and the hex field is empty. The code
  // goes through useDebounce so typing "221" fires ONE suggest (after 250ms of
  // quiet), not three (P0: request-per-keystroke). Gamut stays a direct
  // dependency — changing C/TPX/U is an intentional act, not typing.
  const debouncedCode = useDebounce(code, 250)

  useEffect(() => {
    if (!debouncedCode || hex) return
    suggestPantoneHex(debouncedCode, gamut)
      .then((data) => {
        if (data?.hex_color) setHex(data.hex_color)
      })
      .catch(() => {})
  }, [debouncedCode, gamut, hex])

  // Load an existing color into the creation form for editing; a null hex
  // maps to an empty field so the auto-suggest effect can still run later.
  const onEdit = (color) => {
    setEditingId(color.id)
    setCode(color.code)
    setGamut(color.gamut)
    setPaintType(color.paint_type)
    setHex(color.hex_color || '')
    setMessage(null)
    setError(null)
  }

  // Return to create mode and clear the form.
  const onCancelEdit = () => {
    setEditingId(null)
    setCode('')
    setHex('')
    setGamut('C')
    setPaintType('reactiva')
    setMessage(null)
    setError(null)
  }

  // Form submit stages the confirmation dialog; the real API call runs only
  // after the operator confirms.
  const onCreate = (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    // The gamut selector is validated: only C/TPX/U are expressible, so an
    // out-of-range value can never be submitted as free text.
    if (!isValidGamut(gamut)) {
      setError('Gamut inválido: use C, TPX o U')
      return
    }
    setPendingSubmit(true)
  }

  // Runs after the operator confirms in the dialog — executes the real
  // create/update request (both modes share this flow).
  const confirmSave = async () => {
    setMessage(null)
    setError(null)
    const payload = { code, gamut, paint_type: paintType, hex_color: hex || null }
    try {
      if (editingId !== null) {
        await updatePantone(editingId, payload)
        setEditingId(null)
        setCode('')
        setHex('')
        setMessage('Color actualizado')
      } else {
        await createPantone(payload)
        setCode('')
        setHex('')
        setMessage('Color creado')
      }
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingSubmit(false)
    }
  }

  // Runs AFTER the operator confirms the destructive action in the dialog.
  const onDelete = async (id) => {
    setError(null)
    try {
      await deletePantone(id)
      setMessage('Color eliminado')
      setColors((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    await onDelete(deleteTarget.id)
    setDeleteBusy(false)
    // Close the dialog whether the delete succeeded or failed — the error/success
    // is surfaced in the page's message area.
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Colores Pantone</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onCreate} className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Código *</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="221"
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Gamut *</span>
            <select
              value={gamut}
              onChange={(e) => setGamut(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            >
              {GAMUT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Tipo *</span>
            <select
              value={paintType}
              onChange={(e) => setPaintType(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            >
              <option value="reactiva">reactiva</option>
              <option value="pigmento">pigmento</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">HEX</span>
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder="#00205b"
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
        </div>

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90 min-h-[44px]"
          >
            {editingId !== null ? 'Guardar' : 'Agregar'}
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
        {colors.map((color) => (
          <li key={color.id}>
            <PantoneCard
              pantone={color}
              to={`/pantone/${color.id}`}
              onEdit={() => onEdit(color)}
              onDelete={() => setDeleteTarget(color)}
            />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Eliminar color PMS ${deleteTarget?.code} ${deleteTarget?.gamut}`}
        description="Esta acción es permanente: se eliminará el color del catálogo industrial."
        confirmLabel="Eliminar"
        danger
        busy={deleteBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDialog
        open={pendingSubmit}
        title={editingId !== null ? 'Actualizar color' : 'Crear color'}
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        onConfirm={confirmSave}
        onClose={() => setPendingSubmit(false)}
      >
        <p className="mt-3 text-sm text-slate-600">
          ¿Estás seguro de que quieres {editingId !== null ? 'actualizar' : 'crear'} este color?
        </p>
      </ConfirmDialog>
    </div>
  )
}

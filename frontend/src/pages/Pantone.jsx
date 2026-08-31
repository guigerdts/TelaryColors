// Pantone colors page — Spanish UI. CRUD over /pantone-colors. The catalog
// renders as PantoneCards (Slice F) instead of the legacy Fase 1 table, and
// the create form's gamut selector offers the real options C/TPX/U (validated,
// never free text — pantone-card spec "Gamut Selector").
import { useCallback, useEffect, useState } from 'react'

import { createPantone, deletePantone, listPantone } from '../api/index.js'
import PantoneCard from '../components/PantoneCard.jsx'
import { GAMUT_OPTIONS, isValidGamut } from '../lib/gamut.js'

export default function PantonePage() {
  const [colors, setColors] = useState([])
  const [code, setCode] = useState('')
  const [gamut, setGamut] = useState('C')
  const [paintType, setPaintType] = useState('reactiva')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    listPantone()
      .then(setColors)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onCreate = async (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    // The gamut selector is validated: only C/TPX/U are expressible, so an
    // out-of-range value can never be submitted as free text.
    if (!isValidGamut(gamut)) {
      setError('Gamut inválido: use C, TPX o U')
      return
    }
    try {
      await createPantone({ code, gamut, paint_type: paintType })
      setCode('')
      setMessage('Color creado')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Colores Pantone</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Código</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="221"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Gamut</span>
          <select
            value={gamut}
            onChange={(e) => setGamut(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {GAMUT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Tipo</span>
          <select
            value={paintType}
            onChange={(e) => setPaintType(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="reactiva">reactiva</option>
            <option value="pigmento">pigmento</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-accent-281c px-4 py-1.5 text-sm font-semibold text-white hover:brightness-90"
        >
          Agregar
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {colors.map((color) => (
          <li key={color.id} className="relative">
            <PantoneCard pantone={color} />
            <button
              type="button"
              aria-label={`eliminar ${color.code}`}
              onClick={() => onDelete(color.id)}
              className="absolute right-3 top-3 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white opacity-90 hover:bg-red-700"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

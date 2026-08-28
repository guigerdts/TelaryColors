// Pantone colors page — Spanish UI. CRUD over /pantone-colors.
import { useCallback, useEffect, useState } from 'react'

import { createPantone, deletePantone, listPantone } from '../api/index.js'

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
            placeholder="221 C"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Gamut</span>
          <input
            value={gamut}
            onChange={(e) => setGamut(e.target.value)}
            className="w-20 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
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
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Agregar
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-400">
            <th className="py-2">Código</th>
            <th>Gamut</th>
            <th>Tipo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {colors.map((color) => (
            <tr key={color.id} className="border-b border-slate-100 text-slate-700">
              <td className="py-2 font-medium">{color.code}</td>
              <td>{color.gamut}</td>
              <td>{color.paint_type}</td>
              <td className="text-right">
                <button
                  type="button"
                  onClick={() => onDelete(color.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

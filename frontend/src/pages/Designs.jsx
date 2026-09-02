// Designs page — Spanish UI. Create a design with 1–7 Pantone colors using
// the DesignColorPicker (which disables an 8th), then list existing designs.
import { useEffect, useState } from 'react'

import { createDesign, listDesigns, listPantone } from '../api/index.js'
import DesignColorPicker from '../components/DesignColorPicker.jsx'

export default function DesignsPage() {
  const [designs, setDesigns] = useState([])
  const [colors, setColors] = useState([])
  const [name, setName] = useState('')
  const [paintType, setPaintType] = useState('reactiva')
  const [selectedIds, setSelectedIds] = useState([])
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const refresh = () => {
    listDesigns().then(setDesigns).catch((err) => setError(err.message))
  }

  useEffect(() => {
    listPantone().then(setColors).catch(() => {})
    refresh()
  }, [])

  const onCreate = async (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    try {
      await createDesign({ name, paint_type: paintType, color_ids: selectedIds })
      setMessage('Diseño creado')
      setName('')
      setSelectedIds([])
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Diseños</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={onCreate} className="space-y-4 rounded border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-700">Nuevo diseño</h3>
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
            <span className="block text-xs font-medium text-slate-600">Tipo de pintura</span>
            <select
              value={paintType}
              onChange={(e) => setPaintType(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            >
              <option value="reactiva">reactiva</option>
              <option value="pigmento">pigmento</option>
            </select>
          </label>
        </div>

        <DesignColorPicker allColors={colors} initial={selectedIds} onChange={setSelectedIds} />

        <button
          type="submit"
          className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90"
        >
          Crear diseño
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {designs.map((design) => (
          <li key={design.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">{design.name}</p>
              <span className="text-xs uppercase text-slate-600">{design.paint_type}</span>
            </div>
            <p className="text-xs text-slate-600">{design.colors.length} colores</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

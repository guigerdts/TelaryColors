// Formulas page — Spanish UI. Lists formulas with their nested ingredients
// (gram-normalized) and lets an operator create a new formula for a color.
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { createFormula, listFormulas, listPantone } from '../api/index.js'

const emptyIngredient = { colorant: '', quantity: '', unit: 'g' }

export default function FormulasPage() {
  const [formulas, setFormulas] = useState([])
  const [colors, setColors] = useState([])
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [pantoneColorId, setPantoneColorId] = useState('')
  const [ingredients, setIngredients] = useState([emptyIngredient])
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

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

  const onCreate = async (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    try {
      await createFormula({
        name,
        notes: notes || null,
        pantone_color_id: Number(pantoneColorId),
        ingredients: ingredients
          .filter((ing) => ing.colorant.trim())
          .map((ing) => ({ colorant: ing.colorant, quantity: ing.quantity, unit: ing.unit })),
      })
      setMessage('Fórmula creada')
      setName('')
      setNotes('')
      setPantoneColorId('')
      setIngredients([emptyIngredient])
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Fórmulas</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onCreate} className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-700">Nueva fórmula</h3>
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
            <div key={index} className="flex items-center gap-2">
              <input
                value={ing.colorant}
                onChange={(e) => setIngredient(index, 'colorant', e.target.value)}
                placeholder="Colorante"
                className="flex-1 rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
              />
              <input
                value={ing.quantity}
                onChange={(e) => setIngredient(index, 'quantity', e.target.value)}
                placeholder="Cantidad"
                type="number"
                step="any"
                min="0"
                className="w-28 rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
              />
              <select
                value={ing.unit}
                onChange={(e) => setIngredient(index, 'unit', e.target.value)}
                className="rounded border border-slate-300 px-2 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="text-xs text-red-600 hover:underline"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            className="text-sm text-accent-281c hover:underline"
          >
            + Agregar ingrediente
          </button>
        </div>

        <button
          type="submit"
          className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90"
        >
          Crear fórmula
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {formulas.map((formula) => (
          <li key={formula.id} className="rounded border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-800">{formula.name}</p>
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
    </div>
  )
}

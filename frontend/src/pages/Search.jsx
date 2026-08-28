// Search page — Spanish UI. Debounces the pantone `?q=` input (250ms) before
// firing the search, then renders the matching colors and their formulas.
import { useEffect, useState } from 'react'

import { listFormulas, listReusableSamples, searchPantone } from '../api/index.js'
import SampleFicha from '../components/SampleFicha.jsx'
import { useDebounce } from '../hooks/useDebounce.js'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [formulas, setFormulas] = useState([])
  const [message, setMessage] = useState('')
  const [reusableSamples, setReusableSamples] = useState({})

  const debounced = useDebounce(query, 250)

  // Pantone search fires only after the debounce settles.
  useEffect(() => {
    if (!debounced) {
      setResults([])
      setMessage('')
      return
    }
    let cancelled = false
    searchPantone(debounced)
      .then((colors) => {
        if (cancelled) return
        setResults(colors)
        setMessage(colors.length ? `${colors.length} resultado(s)` : 'Sin resultados')
      })
      .catch((err) => {
        if (!cancelled) setMessage(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  // Load formulas once to show what each found color may be mixed into.
  useEffect(() => {
    let cancelled = false
    listFormulas()
      .then((data) => {
        if (!cancelled) setFormulas(data)
      })
      .catch(() => {
        /* ignore — spotlight is a search/rendering problem */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Client-side ficha: after a search returns colors, fetch each result's
  // reusable samples (GET /samples?pantone_target_id=&status=archivada_reutilizable)
  // and keep them keyed by color id for the card surfaces below.
  useEffect(() => {
    if (!results.length) {
      setReusableSamples({})
      return
    }
    let cancelled = false
    Promise.all(results.map((color) => listReusableSamples(color.id).then((samples) => ({ id: color.id, samples }))))
      .then((all) => {
        if (cancelled) return
        const byColor = {}
        for (const { id, samples } of all) byColor[id] = samples
        setReusableSamples(byColor)
      })
      .catch(() => {
        /* ignore — a failing ficha lookup must not break the search */
      })
    return () => {
      cancelled = true
    }
  }, [results])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Buscar color</h2>

      <input
        aria-label="Buscar color"
        type="search"
        placeholder="Ej.: 221 C"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />

      {message && <p className="text-sm text-slate-500">{message}</p>}

      <ul className="grid gap-3 sm:grid-cols-2">
        {results.map((color) => (
          <li key={color.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{color.code}</span>
              <span className="text-xs uppercase text-slate-400">{color.gamut}</span>
            </div>
            <p className="text-xs text-slate-500">Tipo: {color.paint_type}</p>
            {formulas
              .filter((formula) => formula.pantone_color_id === color.id)
              .map((formula) => (
                <div key={formula.id} className="mt-2 border-t border-dashed border-slate-200 pt-2">
                  <p className="text-sm font-medium text-slate-700">{formula.name}</p>
                  <ul className="ml-4 list-disc text-xs text-slate-500">
                    {formula.ingredients.map((ing) => (
                      <li key={ing.id}>
                        {ing.colorant}: {ing.quantity_g} g
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {reusableSamples[color.id]?.length > 0 && (
              <div className="mt-2 border-t border-dashed border-slate-200 pt-2">
                <p className="text-sm font-medium text-slate-700">
                  Muestras reutilizables ({reusableSamples[color.id].length})
                </p>
                <div className="mt-1 space-y-1">
                  {reusableSamples[color.id].map((sample) => (
                    <SampleFicha key={sample.id} sample={sample} colorCode={color.code} />
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

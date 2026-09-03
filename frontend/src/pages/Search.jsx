// Search page — Spanish UI. Debounces the pantone `?q=` input (250ms) before
// firing the search, then renders the matching colors as PantoneCards (Slice F).
// Redesigned around the search workflow (DESIGN.md §5.4/§5.12/§10): a prominent
// full-width input with icon + count pill next to it, skeleton cards while
// searching, and a teaching empty state. Reusable samples are still fetched in
// ONE batch request (backend caps at the 5 newest per color) but are no longer
// rendered here — samples are viewed from the PantoneDetail ficha instead.
import { useEffect, useState } from 'react'

import { listFormulas, listReusableSamplesByIds, searchPantone } from '../api/index.js'
import PantoneCard from '../components/PantoneCard.jsx'
import { useDebounce } from '../hooks/useDebounce.js'

// Inline icons (same pattern as the Layout shell — stroke, currentColor).
const SearchIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" />
  </svg>
)

const ClearIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [formulas, setFormulas] = useState([])
  const [message, setMessage] = useState('')
  // Samples are fetched in one batch for the PantoneDetail contract, but the
  // value is consumed there — Search only keeps the setter alive (the value
  // itself has no render consumer since the SampleFicha integration was
  // removed from the search results).
  const [, setReusableSamples] = useState({})
  const [searching, setSearching] = useState(false)

  const [debounced] = useDebounce(query, 250)

  // Pantone search fires only after the debounce settles.
  useEffect(() => {
    if (!debounced) {
      setResults([])
      setMessage('')
      return
    }
    let cancelled = false
    setSearching(true)
    searchPantone(debounced)
      .then((colors) => {
        if (cancelled) return
        setResults(colors)
        setMessage(colors.length ? `${colors.length} resultado(s)` : 'Sin resultados')
      })
      .catch((err) => {
        if (!cancelled) setMessage(err.message)
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
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

  // Client-side ficha: after a search returns colors, fetch ALL their reusable
  // samples in ONE batch request (GET /samples?pantone_target_ids=1,2,3
  // &status=archivada_reutilizable) and keep them keyed by color id. Samples
  // are consumed on the PantoneDetail ficha; the fetch stays here so the batch
  // contract survives the redesign.
  useEffect(() => {
    if (!results.length) {
      setReusableSamples({})
      return
    }
    let cancelled = false
    listReusableSamplesByIds(results.map((color) => color.id))
      .then((allSamples) => {
        if (cancelled) return
        const byColor = {}
        for (const s of allSamples) {
          if (!byColor[s.pantone_target_id]) byColor[s.pantone_target_id] = []
          byColor[s.pantone_target_id].push(s)
        }
        setReusableSamples(byColor)
      })
      .catch(() => {
        /* ignore — a failing ficha lookup must not break the search */
      })
    return () => {
      cancelled = true
    }
  }, [results])

  const showEmpty = debounced && !searching && results.length === 0 && !message.startsWith('Error')
  const showResults = results.length > 0
  const resultCount = results.length === 1 ? '1 resultado' : `${results.length} resultados`

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <h2 className="text-xl font-bold text-text-primary">Buscar color</h2>

      {/* Search input — full width on mobile, capped on desktop; icon left,
          clear button right. The results-count pill sits next to the input. */}
      <div className="w-full max-w-lg">
        <label
          htmlFor="pantone-search"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-secondary"
        >
          Buscar color
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              id="pantone-search"
              aria-label="Buscar color"
              type="search"
              placeholder="Ej.: 221"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-border-strong bg-surface-raised py-2.5 pl-10 pr-11 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => { setQuery(''); setResults([]); setMessage(''); }}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              >
                <ClearIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {showResults && (
            <span
              role="status"
              className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-muted"
            >
              {resultCount}
            </span>
          )}
        </div>
      </div>

      {message && message.startsWith('Error') && (
        <p role="alert" className="text-sm text-error-text">
          {message}
        </p>
      )}

      {/* Loading state — skeleton cards matching the PantoneCard shape. */}
      {searching && !showResults && !message.startsWith('Error') && (
        <ul aria-label="Cargando resultados" aria-busy="true" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="overflow-hidden rounded-lg border border-border-default bg-surface-raised shadow-xs"
            >
              <div className="h-24 w-full rounded-t-lg bg-surface-sunken animate-skeleton" />
              <div className="space-y-2 px-4 pt-3 pb-4">
                <div className="h-2 w-1/3 rounded bg-surface-sunken animate-skeleton" />
                <div className="h-3 w-1/2 rounded bg-surface-sunken animate-skeleton" />
              </div>
              <div className="space-y-2 border-t border-border-default px-4 py-3">
                <div className="h-2 w-1/4 rounded bg-surface-sunken animate-skeleton" />
                <div className="h-3 w-full rounded bg-surface-sunken animate-skeleton" />
                <div className="h-3 w-2/3 rounded bg-surface-sunken animate-skeleton" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <div className="rounded border border-border-default bg-surface-raised p-6 text-center">
          <p className="text-sm font-medium text-text-primary">Sin resultados para "{debounced}"</p>
          <p className="mt-1 text-sm text-text-secondary">
            Intenta con un código PMS como 221, 281, o un nombre como "rojo"
          </p>
        </div>
      )}

      {showResults && (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {results.map((color) => {
            const formula = formulas.find((f) => f.pantone_color_id === color.id)
            return (
              <li key={color.id}>
                <PantoneCard pantone={color} formula={formula} to={`/pantone/${color.id}`} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
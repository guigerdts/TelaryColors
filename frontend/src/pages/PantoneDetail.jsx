// PantoneDetail — the extended ficha for a single Pantone/fórmula.
// Self-loads from the URL (Punto 2): resolves pantone + formulas client-side
// via listFormulas() filtering by pantone_color_id, then fetches the formula
// detail. Supports multiple formula selection with a <select> when the pantone
// has more than one formula. Handles loading, error (404 / fetch failure, with
// retry) and empty (no linked designs) states, then delegates rendering to
// <PantoneCard>. Also owns the manual "Vincular diseño" flow: the operator
// links an EXISTING design from listDesigns via linkDesignToFormula.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  getFormulaDetail,
  linkDesignToFormula,
  listDesigns,
  listFormulas,
  listPantone,
} from '../api/index.js'
import PantoneCard from '../components/PantoneCard.jsx'

export default function PantoneDetail() {
  const { id: pantoneId } = useParams()

  const [pantone, setPantone] = useState(null)
  const [formulasForPantone, setFormulasForPantone] = useState([])
  const [selectedFormulaId, setSelectedFormulaId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Existing designs offered by the manual link selector.
  const [designs, setDesigns] = useState([])
  const [designId, setDesignId] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkMessage, setLinkMessage] = useState(null)

  // Fetch the formula detail for a given formula id.
  const loadFormulaDetail = useCallback((formulaId) => {
    setLoading(true)
    setError(null)
    getFormulaDetail(formulaId)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // On mount: resolve pantone metadata + formulas, then load the first formula.
  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      setError(null)
      try {
        const [allFormulas, allPantones] = await Promise.all([
          listFormulas(),
          listPantone(),
        ])
        if (cancelled) return

        const numericId = Number(pantoneId)
        const matchedPantone = allPantones.find((p) => p.id === numericId)
        const matchedFormulas = allFormulas.filter((f) => f.pantone_color_id === numericId)

        setPantone(matchedPantone)
        setFormulasForPantone(matchedFormulas)

        if (matchedFormulas.length > 0) {
          const firstFormula = matchedFormulas[0]
          setSelectedFormulaId(firstFormula.id)
          // loadFormulaDetail will set loading/error/detail.
          setLoading(true)
          const detailResult = await getFormulaDetail(firstFormula.id)
          if (!cancelled) setDetail(detailResult)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantoneId])

  // Load existing designs for the manual link selector.
  useEffect(() => {
    let cancelled = false
    listDesigns()
      .then((data) => {
        if (!cancelled) setDesigns(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        /* best-effort — the ficha still renders */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // When the user switches formula via the selector.
  const onFormulaChange = (e) => {
    const newId = Number(e.target.value)
    setSelectedFormulaId(newId)
    loadFormulaDetail(newId)
  }

  const onLink = async (event) => {
    event.preventDefault()
    if (!designId || !selectedFormulaId) return
    setLinkMessage(null)
    setLinking(true)
    try {
      await linkDesignToFormula(selectedFormulaId, { design_id: Number(designId) })
      setDesignId('')
      setLinkMessage('Diseño vinculado')
      // Re-fetch so the freshly linked design shows in the ficha.
      loadFormulaDetail(selectedFormulaId)
    } catch (err) {
      setLinkMessage(err.message)
    } finally {
      setLinking(false)
    }
  }

  if (loading && !detail) {
    return (
      <div className="space-y-4">
        {/* Skeleton card matching PantoneCard shape */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="h-24 w-full bg-slate-200 animate-pulse" />
          <div className="space-y-2 px-4 py-3">
            <div className="h-3 w-1/3 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="h-3 w-1/4 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 space-y-1">
              <div className="h-3 w-full rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-slate-200 animate-pulse" />
            </div>
          </div>
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="h-3 w-1/3 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
        <p className="text-sm text-slate-400 italic">Cargando ficha…</p>
      </div>
    )
  }

  if (error && !detail) {
    return (
      <div className="space-y-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => selectedFormulaId && loadFormulaDetail(selectedFormulaId)}
          className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (formulasForPantone.length === 0 && !loading) {
    return <p className="text-sm text-slate-500">No hay fórmulas para este Pantone</p>
  }

  return (
    <div className="space-y-4">
      {/* Formula selector — visible only when there are multiple formulas. */}
      {formulasForPantone.length > 1 && (
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fórmula
          </span>
          <select
            aria-label="Seleccionar fórmula"
            value={selectedFormulaId ?? ''}
            onChange={onFormulaChange}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          >
            {formulasForPantone.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {detail && (
        <PantoneCard pantone={pantone} formula={detail} designs={detail.designs} />
      )}

      {/* Manual link flow: only existing designs, never inline creation. */}
      {detail && (
        <form onSubmit={onLink} className="rounded border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vincular diseño
          </h3>
          {linkMessage && (
            <p className="mt-2 text-sm text-slate-600">{linkMessage}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="block text-xs font-medium text-slate-600">Diseño existente</span>
              <select
                aria-label="Vincular diseño existente"
                value={designId}
                onChange={(e) => setDesignId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
              >
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!designId || linking}
              className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {linking ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

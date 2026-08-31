// PantoneDetail — the extended ficha for a single Pantone/fórmula (Slice E/F).
// Consumes the rich detail endpoint GET /formulas/{id}/detail in a SINGLE call
// (design D3 / user confirmation): the formula and its deduplicated linked
// designs come together in one response — there is no separate request for the
// designs. Handles loading, error (404 / fetch failure, with retry) and empty
// (no linked designs) states, then delegates rendering to <PantoneCard>.
// Also owns the manual "Vincular diseño" flow (Slice F.5): the operator links
// an EXISTING design from listDesigns via linkDesignToFormula — only existing
// designs are offered, never inline creation (creation lives in /designs).
import { useEffect, useState } from 'react'

import { getFormulaDetail, linkDesignToFormula, listDesigns } from '../api/index.js'
import PantoneCard from '../components/PantoneCard.jsx'

export default function PantoneDetail({ formulaId, pantone }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Existing designs offered by the manual link selector (F.5).
  const [designs, setDesigns] = useState([])
  const [designId, setDesignId] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkMessage, setLinkMessage] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    // One call: formula + deduplicated designs in a single response.
    getFormulaDetail(formulaId)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // Only existing designs are offered for a manual link — no inline creation.
    let cancelled = false
    listDesigns()
      .then((data) => {
        // Guard against a non-array response (some test mocks return the detail
        // object for every URL); never render map over a non-array.
        if (!cancelled) setDesigns(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        /* the design list is best-effort; the ficha still renders */
      })
    return () => {
      cancelled = true
    }
    // formulaId is stable per mount; reload only when the id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaId])

  const onLink = async (event) => {
    event.preventDefault()
    if (!designId) return
    setLinkMessage(null)
    setLinking(true)
    try {
      await linkDesignToFormula(formulaId, { design_id: Number(designId) })
      setDesignId('')
      setLinkMessage('Diseño vinculado')
      // Re-fetch so the freshly linked design shows in the ficha.
      load()
    } catch (err) {
      setLinkMessage(err.message)
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando ficha…</p>
  }

  if (error) {
    return (
      <div className="space-y-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PantoneCard pantone={pantone} formula={detail} designs={detail.designs} />

      {/* Manual link flow: only existing designs, never inline creation. */}
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
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
    </div>
  )
}

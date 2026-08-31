// PantoneDetail — the extended ficha for a single Pantone/fórmula (Slice E).
// Consumes the rich detail endpoint GET /formulas/{id}/detail in a SINGLE call
// (design D3 / user confirmation): the formula and its deduplicated linked
// designs come together in one response — there is no separate request for the
// designs. Handles loading, error (404 / fetch failure, with retry) and empty
// (no linked designs) states, then delegates rendering to <PantoneCard>.
import { useEffect, useState } from 'react'

import { getFormulaDetail } from '../api/index.js'
import PantoneCard from '../components/PantoneCard.jsx'

export default function PantoneDetail({ formulaId, pantone }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    // formulaId is stable per mount; reload only when the id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaId])

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

  return <PantoneCard pantone={pantone} formula={detail} designs={detail.designs} />
}

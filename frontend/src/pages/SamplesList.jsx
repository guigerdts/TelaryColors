// SamplesList — Spanish UI. The "Muestras" destination/browse page (fixes the
// nav dead-end): lists EVERY sample via listSamples() (GET /samples, no
// filters → newest-first, no cap) as design-system cards. Each card resolves
// its Pantone target code from listPantone() for the SampleFicha alt text and
// embeds the reusable SampleFicha (thumbnail + promote), mirroring how Search
// composes SampleFicha inside a card. A "Nueva muestra" button links to the
// create form at /muestras.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { listPantone, listSamples } from '../api/index.js'
import SampleFicha from '../components/SampleFicha.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatDateTime } from '../lib/datetime.js'

export default function SamplesListPage() {
  const [samples, setSamples] = useState([])
  const [pantones, setPantones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    // Samples + their Pantone targets load together; a failing pantone lookup
    // must not hide the samples themselves, so we settle them independently.
    listSamples()
      .then(setSamples)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    listPantone()
      .then(setPantones)
      .catch(() => {
        /* target codes are decoration — samples still render */
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Id → "code gamut" map so each card can show its Pantone target.
  const codeById = useMemo(() => {
    const map = {}
    for (const p of pantones) map[p.id] = `${p.code} ${p.gamut}`.trim()
    return map
  }, [pantones])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-text-primary">Muestras</h2>
        <Link
          to="/muestras"
          className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-text-inverse hover:brightness-90 min-h-[44px]"
        >
          Nueva muestra
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded bg-error-bg px-3 py-2 text-sm text-error-text">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted italic">Cargando muestras…</p>
      ) : samples.length === 0 ? (
        <p className="rounded border border-border-default bg-surface-raised p-4 text-sm text-text-secondary">
          No hay muestras registradas.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {samples.map((sample) => (
            <li
              key={sample.id}
              className="rounded border border-border-default bg-surface-raised p-3"
            >
              <article role="article" className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span                     className="text-sm font-semibold text-text-primary">
                    {codeById[sample.pantone_target_id] || `Pantone #${sample.pantone_target_id}`}
                  </span>
                  <StatusBadge status={sample.status} />
                </div>

                {sample.photo_url ? (
                  <img
                    src={sample.photo_url}
                    alt={`Muestra reutilizable de ${codeById[sample.pantone_target_id] || 'Pantone'}`}
                    className="h-24 w-full rounded border border-border-default object-cover"
                  />
                ) : (
                  <span className="block rounded border border-dashed border-border-default p-6 text-center text-xs text-text-secondary">
                    Sin foto
                  </span>
                )}

                {sample.notes && (
                  <p className="text-sm text-text-secondary">{sample.notes}</p>
                )}

                {sample.created_at && (
                  <p className="text-xs text-text-muted">
                    Creada {formatDateTime(sample.created_at)}
                  </p>
                )}

                <SampleFicha
                  sample={sample}
                  colorCode={codeById[sample.pantone_target_id] || `Pantone #${sample.pantone_target_id}`}
                />
              </article>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-accent-281c/60 px-3 py-1.5 text-sm text-accent-281c hover:bg-accent-281c/10 min-h-[44px]"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

// DesignDetail — ficha de un Diseño individual.
// Self-loads from the URL: resolve design + formulas (cross-referenced via
// pantone_color_id). Shows colors/Pantones, formulas, and metadata.
// "El Laboratorio de Precisión" — color como dato.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getDesign, listFormulas, listPantone } from '../api/index.js'
import ColorSwatch from '../components/ColorSwatch.jsx'

export default function DesignDetail() {
  const { id } = useParams()
  const [design, setDesign] = useState(null)
  const [colors, setColors] = useState([])
  const [formulas, setFormulas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [designData, allPantones, allFormulas] = await Promise.all([
          getDesign(id),
          listPantone(),
          listFormulas(),
        ])
        if (cancelled) return

        setDesign(designData)
        setColors(allPantones)

        // Cross-reference: formulas whose pantone_color_id is in this design's colors
        const designColorIds = new Set(designData.colors.map((c) => c.pantone_color_id))
        const linkedFormulas = allFormulas.filter((f) => designColorIds.has(f.pantone_color_id))
        setFormulas(linkedFormulas)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  // Resolve a Pantone color object from the global list
  const resolveColor = (pantoneColorId) => colors.find((c) => c.id === pantoneColorId)

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-5" aria-label="Cargando diseño" aria-busy="true">
        <div className="h-3 w-32 animate-pulse rounded bg-surface-sunken" />
        <div className="space-y-3">
          <div className="h-6 w-64 animate-pulse rounded bg-surface-sunken" />
          <div className="h-4 w-24 animate-pulse rounded bg-surface-sunken" />
        </div>
        <div className="h-20 animate-pulse rounded-lg bg-surface-sunken" />
        <div className="space-y-2 rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-sunken" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <nav className="text-sm text-text-muted">
          <Link to="/designs" className="text-primary-500 hover:text-primary-600">
            Diseños
          </Link>
        </nav>
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-error-border bg-error-bg px-5 py-4 text-sm text-error-text"
        >
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] rounded bg-error-text px-4 py-2 text-xs font-semibold text-text-inverse hover:brightness-90"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Not found (404) ────────────────────────────────────────────────────
  if (!design) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <nav className="text-sm text-text-muted">
          <Link to="/designs" className="text-primary-500 hover:text-primary-600">
            Diseños
          </Link>
        </nav>
        <div className="rounded-lg border border-border-default bg-surface-raised p-10 text-center shadow-xs">
          <p className="text-sm font-medium text-text-secondary">Diseño no encontrado</p>
          <p className="mt-1 text-xs text-text-muted">El diseño que buscás no existe o fue eliminado.</p>
        </div>
      </div>
    )
  }

  const designColors = design.colors
    .map((dc) => ({ ...dc, pantone: resolveColor(dc.pantone_color_id) }))
    .filter((c) => c.pantone)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link to="/designs" className="text-primary-500 hover:text-primary-600">
              Diseños
            </Link>
          </li>
          <li aria-hidden="true" className="text-text-disabled">→</li>
          <li className="font-medium text-text-secondary">{design.name}</li>
        </ol>
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">{design.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-secondary capitalize">
            {design.paint_type}
          </span>
          {design.client && (
            <span className="text-xs text-text-muted">Cliente: {design.client}</span>
          )}
        </div>
      </div>

      {/* ── Colors / Pantones ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Colores / Pantones
        </h2>
        {designColors.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {designColors.map((dc) => (
              <div
                key={dc.pantone_color_id}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3 shadow-xs"
              >
                <ColorSwatch code={dc.pantone.code} hex={dc.pantone.hex_color} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">{dc.pantone.code}</p>
                  {dc.pantone.name && (
                    <p className="truncate text-xs text-text-muted">{dc.pantone.name}</p>
                  )}
                  {dc.pantone.hex_color && (
                    <p className="font-mono text-xs tabular-nums text-text-secondary">
                      {dc.pantone.hex_color.toUpperCase()}
                    </p>
                  )}
                </div>
                <Link
                  to={`/pantone/${dc.pantone_color_id}`}
                  className="ml-auto shrink-0 text-xs font-medium text-primary-500 hover:text-primary-600 hover:underline"
                >
                  Ver
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">Sin colores asignados</p>
        )}
      </section>

      {/* ── Formulas ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Fórmulas asociadas
        </h2>
        {formulas.length > 0 ? (
          <div className="mt-3 divide-y divide-border-default overflow-hidden rounded-lg border border-border-default bg-surface-raised shadow-xs">
            {formulas.map((formula) => {
              const formulaColor = resolveColor(formula.pantone_color_id)
              return (
                <div key={formula.id} className="flex items-center gap-3 px-4 py-3">
                  {formulaColor && (
                    <ColorSwatch code={formulaColor.code} hex={formulaColor.hex_color} size="xs" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{formula.name}</p>
                    <p className="text-xs text-text-muted">
                      {formula.ingredients.length}{' '}
                      {formula.ingredients.length === 1 ? 'ingrediente' : 'ingredientes'}
                    </p>
                  </div>
                  <Link
                    to={`/pantone/${formula.pantone_color_id}`}
                    className="shrink-0 text-xs font-medium text-primary-500 hover:text-primary-600 hover:underline"
                  >
                    Ver ficha
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-border-default bg-surface-raised p-6 text-center shadow-xs">
            <p className="text-sm text-text-secondary">Sin fórmulas asociadas</p>
            <p className="mt-1 text-xs text-text-muted">
              Las fórmulas se vinculan desde la ficha de cada Pantone.
            </p>
          </div>
        )}
      </section>

      {/* ── Metadata ────────────────────────────────────────────────────── */}
      {(design.notes || design.created_at) && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Información adicional
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            {design.notes && (
              <div>
                <dt className="text-xs text-text-muted">Notas</dt>
                <dd className="mt-0.5 text-text-secondary">{design.notes}</dd>
              </div>
            )}
            {design.created_at && (
              <div>
                <dt className="text-xs text-text-muted">Creado</dt>
                <dd className="mt-0.5 text-text-secondary tabular-nums">
                  {new Date(design.created_at).toLocaleDateString('es-AR')}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          to="/designs"
          className="min-h-[44px] rounded border border-border-strong bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken"
        >
          ← Volver a Diseños
        </Link>
      </div>
    </div>
  )
}

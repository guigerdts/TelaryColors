// PantoneDetail — the extended ficha for a single Pantone/fórmula.
// Self-loads from the URL (Punto 2): resolves pantone + formulas client-side
// via listFormulas() filtering by pantone_color_id, then fetches the formula
// detail. Supports multiple formula selection with tabs when the pantone
// has more than one formula. Handles loading, error (404 / fetch failure, with
// retry) and empty (no linked designs) states. Also owns the manual "Vincular
// diseño" flow: the operator links an EXISTING design from listDesigns via
// linkDesignToFormula.
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  getFormulaDetail,
  linkDesignToFormula,
  listDesigns,
  listFormulas,
  listPantone,
} from '../api/index.js'
import CopyIcon from '../components/icons/CopyIcon.jsx'

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
  // Hex copy feedback
  const [copied, setCopied] = useState(false)

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
    return () => { cancelled = true }
  }, [pantoneId])

  // Load existing designs for the manual link selector.
  useEffect(() => {
    let cancelled = false
    listDesigns()
      .then((data) => {
        if (!cancelled) setDesigns(Array.isArray(data) ? data : [])
      })
      .catch(() => { /* best-effort — the ficha still renders */ })
    return () => { cancelled = true }
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
      loadFormulaDetail(selectedFormulaId)
    } catch (err) {
      setLinkMessage(err.message)
    } finally {
      setLinking(false)
    }
  }

  const copyHex = async () => {
    const hex = pantone?.hex_color
    if (!hex) return
    try {
      await navigator.clipboard.writeText(hex.toUpperCase())
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* clipboard not available */ }
  }

  const hex = pantone?.hex_color
  const code = pantone?.code ?? ''
  const gamut = pantone?.gamut ?? ''
  const pmsCode = `PMS ${code} ${gamut}`.trim()
  const paintType = pantone?.paint_type ?? ''

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading && !detail) {
    return (
      <div className="mx-auto max-w-4xl space-y-6" aria-label="Cargando fórmula" aria-busy="true">
        {/* Breadcrumb skeleton */}
        <div className="h-3 w-48 animate-pulse rounded bg-surface-sunken" />

        {/* Color hero skeleton */}
        <div className="h-24 w-full animate-pulse rounded-lg bg-surface-sunken md:h-32" />

        {/* Meta skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded bg-surface-sunken" />
          <div className="h-3 w-24 animate-pulse rounded bg-surface-sunken" />
          <div className="h-3 w-40 animate-pulse rounded bg-surface-sunken" />
        </div>

        {/* Formula skeleton */}
        <div className="space-y-3 rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          <div className="h-4 w-48 animate-pulse rounded bg-surface-sunken" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-1/3 animate-pulse rounded bg-surface-sunken" />
                <div className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────
  if (error && !detail) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="text-sm text-text-muted">
          <Link to="/buscar" className="text-primary-500 hover:text-primary-600">Buscar</Link>
        </nav>
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-error-border bg-error-bg px-5 py-4 text-sm text-error-text"
        >
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => selectedFormulaId && loadFormulaDetail(selectedFormulaId)}
            className="rounded bg-error-text px-4 py-2 text-xs font-semibold text-text-inverse hover:brightness-90 min-h-[44px]"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── No formulas ───────────────────────────────────────────────────────
  if (formulasForPantone.length === 0 && !loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="text-sm text-text-muted">
          <Link to="/buscar" className="text-primary-500 hover:text-primary-600">Buscar</Link>
        </nav>
        <div className="rounded-lg border border-border-default bg-surface-raised p-8 text-center shadow-xs">
          <p className="text-sm text-text-secondary">No hay fórmulas para este Pantone</p>
        </div>
      </div>
    )
  }

  const ingredients = detail?.ingredients ?? []
  const linkedDesigns = detail?.designs ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link to="/buscar" className="text-primary-500 hover:text-primary-600">Buscar</Link>
          </li>
          <li aria-hidden="true" className="text-text-disabled">→</li>
          <li className="font-medium text-text-secondary">{pmsCode || `#${pantoneId}`}</li>
        </ol>
      </nav>

      {/* ── Color hero ──────────────────────────────────────────────────── */}
      {hex ? (
        <div
          role="img"
          aria-label={`Color ${pmsCode}`}
          className="h-24 w-full rounded-lg md:h-32"
          style={{ backgroundColor: hex }}
        />
      ) : (
        <div
          role="img"
          aria-label={`${pmsCode} — sin color asignado`}
          className="h-24 w-full rounded-lg bg-surface-sunken md:h-32"
        />
      )}

      {/* ── Pantone metadata ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-text-primary">{pmsCode || `#${pantoneId}`}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {gamut && (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-500">
              {gamut}
            </span>
          )}
          {paintType && (
            <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-secondary capitalize">
              {paintType}
            </span>
          )}
        </div>

        {hex && (
          <div className="flex items-center gap-1">
            <code className="font-mono text-xs text-text-secondary tabular-nums">
              {hex.toUpperCase()}
            </code>
            <button
              type="button"
              aria-label={`Copiar ${hex.toUpperCase()}`}
              onClick={copyHex}
              title="Copiar código HEX"
              className="flex h-11 w-11 items-center justify-center rounded text-text-muted hover:bg-surface-sunken hover:text-text-primary"
            >
              {copied ? (
                <span className="text-success-text text-xs font-medium">✓</span>
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Formula selector (when multiple formulas exist) ─────────────── */}
      {formulasForPantone.length > 1 && (
        <div className="space-y-1">
          <label
            htmlFor="formula-select"
            className="text-xs font-medium uppercase tracking-wider text-text-muted"
          >
            Fórmula
          </label>
          <select
            id="formula-select"
            aria-label="Seleccionar fórmula"
            value={selectedFormulaId ?? ''}
            onChange={onFormulaChange}
            className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            {formulasForPantone.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Formula ingredients ─────────────────────────────────────────── */}
      {detail && (
        <section aria-label={`${detail.name || 'Fórmula'} — Ingredientes`} className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {detail.name || 'Fórmula'} — Ingredientes
          </h2>
          {ingredients.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded border border-border-default">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto] gap-4 bg-surface-sunken px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                <span>Colorante</span>
                <span className="text-right">Cantidad</span>
              </div>
              {/* Table rows */}
              {ingredients.map((ing, i) => (
                <div
                  key={ing.id ?? i}
                  className={`grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 text-sm ${
                    i % 2 === 0 ? 'bg-surface-raised' : 'bg-surface-sunken'
                  }`}
                >
                  <span className="truncate text-text-secondary">{ing.colorant}</span>
                  <span className="shrink-0 whitespace-nowrap font-medium text-text-primary tabular-nums">
                    {Number(ing.quantity_g).toFixed(2)} g
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-text-muted">Sin ingredientes registrados</p>
          )}
        </section>
      )}

      {/* ── Designs that use this formula ───────────────────────────────── */}
      {detail && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Diseños vinculados
          </h2>
          {linkedDesigns.length > 0 ? (
            <ul className="mt-3 divide-y divide-border-default">
              {linkedDesigns.map((design) => (
                <li key={design.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{design.name}</p>
                    {design.client && (
                      <p className="truncate text-xs text-text-muted">{design.client}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-text-muted">Sin diseños vinculados</p>
          )}
        </section>
      )}

      {/* ── Samples section ─────────────────────────────────────────────── */}
      {detail && (
        <section className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Muestras
          </h2>
          {detail.samples && detail.samples.length > 0 ? (
            <ul className="mt-3 divide-y divide-border-default">
              {detail.samples.map((sample, i) => (
                <li key={sample.id ?? i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{sample.name || `Muestra #${sample.id}`}</p>
                    {sample.note && (
                      <p className="truncate text-xs text-text-muted">{sample.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-text-muted">Sin muestras registradas</p>
          )}
        </section>
      )}

      {/* ── Link formula to design ──────────────────────────────────────── */}
      {detail && (
        <form onSubmit={onLink} className="rounded-lg border border-border-default bg-surface-raised p-4 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Vincular diseño
          </h2>
          {linkMessage && (
            <div
              role="status"
              className={`mt-3 rounded px-3 py-2 text-sm ${
                linkMessage === 'Diseño vinculado'
                  ? 'bg-success-bg text-success-text'
                  : 'bg-error-bg text-error-text'
              }`}
            >
              {linkMessage}
            </div>
          )}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="block text-xs font-medium uppercase tracking-wider text-text-muted">
                Diseño existente
              </span>
              <select
                aria-label="Vincular diseño existente"
                value={designId}
                onChange={(e) => setDesignId(e.target.value)}
                className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              >
                <option value="">Seleccionar…</option>
                {designs.map((design) => (
                  <option key={design.id} value={design.id}>{design.name}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!designId || linking}
              className="min-h-[44px] rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {linking ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

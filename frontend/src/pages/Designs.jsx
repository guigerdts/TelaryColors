// Designs page — Spanish UI. Create, list, search, and edit designs.
// Visual: "El Laboratorio de Precisión" — color como dato.
// Fase 3.3: CRUD — crear y editar. Modal for edit, inline for create.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { createDesign, listDesigns, listPantone, updateDesign } from '../api/index.js'
import ColorSwatch from '../components/ColorSwatch.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import DesignForm from '../components/DesignForm.jsx'

export default function DesignsPage() {
  const [designs, setDesigns] = useState([])
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [colorsWarning, setColorsWarning] = useState(null)

  // ── Create state ─────────────────────────────────────────────────────────
  const [createName, setCreateName] = useState('')
  const [createPaintType, setCreatePaintType] = useState('reactiva')
  const [createSelectedIds, setCreateSelectedIds] = useState([])
  const [createPendingSubmit, setCreatePendingSubmit] = useState(false)

  // ── Edit state ───────────────────────────────────────────────────────────
  const [editingDesign, setEditingDesign] = useState(null) // design object or null
  const [editName, setEditName] = useState('')
  const [editPaintType, setEditPaintType] = useState('reactiva')
  const [editSelectedIds, setEditSelectedIds] = useState([])
  const [editPendingSubmit, setEditPendingSubmit] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // ── Search and filter ────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const refresh = () => {
    setLoading(true)
    listDesigns()
      .then(setDesigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listPantone()
      .then(setColors)
      .catch(() => setColorsWarning('No se pudieron cargar los colores Pantone'))
    refresh()
  }, [])

  // ── Create handlers ──────────────────────────────────────────────────────
  const onCreate = (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setCreatePendingSubmit(true)
  }

  const confirmCreate = async () => {
    setMessage(null)
    setError(null)
    try {
      await createDesign({ name: createName, paint_type: createPaintType, color_ids: createSelectedIds })
      setMessage('Diseño creado')
      setCreateName('')
      setCreateSelectedIds([])
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatePendingSubmit(false)
    }
  }

  // ── Edit handlers ────────────────────────────────────────────────────────
  const onEdit = (design) => {
    setMessage(null)
    setError(null)
    setEditError(null)
    setEditingDesign(design)
    setEditName(design.name)
    setEditPaintType(design.paint_type)
    // Extract pantone_color_ids from the design's colors array
    setEditSelectedIds(design.colors.map((c) => c.pantone_color_id))
    setEditPendingSubmit(true)
  }

  const confirmEdit = async () => {
    setEditError(null)
    setEditSaving(true)
    try {
      await updateDesign(editingDesign.id, {
        name: editName,
        paint_type: editPaintType,
        color_ids: editSelectedIds,
      })
      setMessage('Diseño actualizado')
      setEditingDesign(null)
      setEditPendingSubmit(false)
      refresh()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingDesign(null)
    setEditPendingSubmit(false)
    setEditError(null)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resolveColors = (design) =>
    design.colors
      .map((dc) => colors.find((c) => c.id === dc.pantone_color_id))
      .filter(Boolean)

  const filteredDesigns = useMemo(() => {
    let result = designs
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((d) => d.name.toLowerCase().includes(q))
    }
    if (filterType) {
      result = result.filter((d) => d.paint_type === filterType)
    }
    return result
  }, [designs, search, filterType])

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-text-primary">Diseños</h1>
        {!loading && designs.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-secondary tabular-nums">
            {designs.length}
          </span>
        )}
      </div>

      {/* ── Success / Error messages ────────────────────────────────────── */}
      {message && (
        <div role="status" className="rounded-lg bg-success-bg px-4 py-3 text-sm font-medium text-success-text">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg bg-error-bg px-4 py-3 text-sm font-medium text-error-text">
          {error}
        </div>
      )}
      {colorsWarning && (
        <div role="status" className="rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning-text">
          {colorsWarning}
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────────────── */}
      <form onSubmit={onCreate} className="rounded-lg border border-border-default bg-surface-raised p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-text-primary">Nuevo diseño</h2>
        <div className="mt-4">
          <DesignForm
            name={createName}
            onNameChange={setCreateName}
            paintType={createPaintType}
            onPaintTypeChange={setCreatePaintType}
            allColors={colors}
            selectedIds={createSelectedIds}
            onColorsChange={setCreateSelectedIds}
          />
        </div>
        <div className="mt-5">
          <button
            type="submit"
            className="min-h-[44px] rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-primary-600"
          >
            Crear diseño
          </button>
        </div>
      </form>

      {/* ── Search and filter bar ───────────────────────────────────────── */}
      {designs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="design-search" className="sr-only">
              Buscar diseño
            </label>
            <input
              id="design-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar diseño…"
              className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" />
            </svg>
          </div>
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Tipo:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded border border-border-strong bg-surface-raised px-2.5 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">Todos</option>
              <option value="reactiva">Reactiva</option>
              <option value="pigmento">Pigmento</option>
            </select>
          </label>
        </div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2" role="status" aria-label="Cargando diseños">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-[skeleton_1.5s_ease-in-out_infinite] rounded-lg bg-surface-sunken"
            />
          ))}
        </div>
      )}

      {/* ── Design table (desktop) ──────────────────────────────────────── */}
      {!loading && filteredDesigns.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-border-default bg-surface-raised shadow-xs md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-sunken text-xs font-medium uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2.5" scope="col">
                    Colores
                  </th>
                  <th className="px-4 py-2.5" scope="col">
                    Nombre
                  </th>
                  <th className="px-4 py-2.5" scope="col">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-right" scope="col">
                    Pantones
                  </th>
                  <th className="px-4 py-2.5 text-right" scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDesigns.map((design) => {
                  const designColors = resolveColors(design)
                  return (
                    <tr
                      key={design.id}
                      className="border-b border-border-default last:border-b-0 hover:bg-surface-sunken transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {designColors.length > 0
                            ? designColors.map((color) => (
                                <ColorSwatch
                                  key={color.id}
                                  code={color.code}
                                  hex={color.hex_color}
                                  size="xs"
                                />
                              ))
                            : Array.from({ length: design.colors.length }).map((_, i) => (
                                <span
                                  key={i}
                                  className="inline-block h-3 w-3 shrink-0 rounded-full border border-border-default bg-surface-sunken"
                                  aria-label={`Color ${i + 1} (cargando)`}
                                />
                              ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">{design.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-secondary capitalize">
                          {design.paint_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                        {design.colors.length}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/designs/${design.id}`}
                            className="text-xs font-medium text-primary-500 hover:text-primary-600 hover:underline"
                          >
                            Ver
                          </Link>
                          <button
                            type="button"
                            onClick={() => onEdit(design)}
                            className="text-xs font-medium text-primary-500 hover:text-primary-600 hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {filteredDesigns.map((design) => {
              const designColors = resolveColors(design)
              return (
                <li
                  key={design.id}
                  className="rounded-lg border border-border-default bg-surface-raised p-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{design.name}</p>
                      <span className="mt-0.5 inline-block rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-secondary capitalize">
                        {design.paint_type}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs tabular-nums text-text-muted">
                        {design.colors.length} {design.colors.length === 1 ? 'color' : 'colores'}
                      </span>
                      <Link
                        to={`/designs/${design.id}`}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center text-xs font-medium text-primary-500 hover:text-primary-600 hover:underline"
                      >
                        Ver
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(design)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center text-xs font-medium text-primary-500 hover:text-primary-600 hover:underline"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  {designColors.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {designColors.map((color) => (
                        <ColorSwatch key={color.id} code={color.code} hex={color.hex_color} size="xs" />
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* ── Empty state (no designs at all) ─────────────────────────────── */}
      {!loading && designs.length === 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-10 text-center shadow-xs">
          <p className="text-sm font-medium text-text-secondary">Sin diseños creados</p>
          <p className="mt-1 text-xs text-text-muted">Crea tu primer diseño para comenzar.</p>
        </div>
      )}

      {/* ── No results state (search/filter yields nothing) ──────────────── */}
      {!loading && designs.length > 0 && filteredDesigns.length === 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-text-secondary">
            No se encontraron diseños
            {search.trim() && (
              <> para &ldquo;{search.trim()}&rdquo;</>
            )}
            {filterType && (
              <> de tipo {filterType}</>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFilterType('')
            }}
            className="mt-3 text-sm font-medium text-primary-500 hover:text-primary-600 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Create confirmation dialog ──────────────────────────────────── */}
      <ConfirmDialog
        open={createPendingSubmit}
        title="Crear diseño"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        onConfirm={confirmCreate}
        onClose={() => setCreatePendingSubmit(false)}
      >
        <p className="mt-3 text-sm text-text-secondary">
          ¿Estás seguro de que quieres crear el diseño &ldquo;{createName}&rdquo;?
        </p>
      </ConfirmDialog>

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={editPendingSubmit}
        title="Editar diseño"
        confirmLabel="Guardar cambios"
        cancelLabel="Cancelar"
        onConfirm={confirmEdit}
        onClose={cancelEdit}
        busy={editSaving}
      >
        {editError && (
          <div role="alert" className="mt-3 rounded-lg bg-error-bg px-3 py-2 text-sm font-medium text-error-text">
            {editError}
          </div>
        )}
        <div className="mt-3">
          <DesignForm
            name={editName}
            onNameChange={setEditName}
            paintType={editPaintType}
            onPaintTypeChange={setEditPaintType}
            allColors={colors}
            selectedIds={editSelectedIds}
            onColorsChange={setEditSelectedIds}
            disabled={editSaving}
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}

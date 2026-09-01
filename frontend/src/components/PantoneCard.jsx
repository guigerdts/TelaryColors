// PantoneCard — the central component of the app (FASE4 spec §4, pantone-card
// spec). Renders a solid color block spanning the card width, a white strip with
// the PANTONE® wordmark + code+gamut + HEX, then the color formula in
// grams/kilo and the linked designs/clients as SEPARATE dimensions (design D2 /
// user confirmation: design_colors composition vs formula_designs usage are
// distinct and never merged).
//
// Hover elevation is built through the /impeccable animate playbook: a vertical
// translate (transform) combined with a growing box-shadow through a transition
// (natural deceleration), not a hand-hardcoded static shadow.
//
// Presentational: the caller supplies `pantone` (code/gamut/hex_color) and the
// already fetched `formula` + `designs` (the ficha owns the single detail call).
// Optional `to` prop wraps the entire card in a <Link> for navigation (Punto 2).
import { Link } from 'react-router-dom'

import { formatDateTime } from '../lib/datetime.js'

export default function PantoneCard({ pantone, formula, designs = [], to, onEdit, onDelete }) {
  const code = pantone?.code ?? ''
  const gamut = pantone?.gamut ?? ''
  const pmsCode = `PMS ${code} ${gamut}`.trim()
  const hex = pantone?.hex_color
  const pmsCodeLabel = `Pantone ${pmsCode}`

  const card = (
    <article
      role="article"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-transform duration-200 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg motion-safe:active:scale-[0.98] motion-safe:active:shadow-md"
    >
      {/* Solid color block — full card width representation of the Pantone. */}
      <div
        role="img"
        aria-label={pmsCodeLabel}
        className="h-24 w-full"
        style={{ backgroundColor: hex || '#334155' }}
      />

      {/* White strip: wordmark + code+gamut + HEX. */}
      <div className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <span className="text-xs font-black tracking-[0.12em] text-slate-800">PANTONE®</span>
        <span className="text-sm font-semibold text-slate-700">{pmsCode}</span>
        {hex ? (
          <span className="font-mono text-xs text-slate-500">{hex.toUpperCase()}</span>
        ) : (
          <span className="text-xs text-slate-400">Sin color asignado</span>
        )}
      </div>

      {/* Formula — color composition in grams/kilo (design_colors dimension). */}
      <section aria-label="Fórmula (g/kg)" className="px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fórmula (g/kg)
        </h3>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {formula?.ingredients?.map((ing) => (
            <li key={ing.id} className="flex justify-between gap-2 text-sm text-slate-700">
              <span>{ing.colorant}</span>
              <span className="whitespace-nowrap font-medium">{Number(ing.quantity_g)} g</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Designs that use this formula (formula_designs dimension) — separate. */}
      <section aria-label="Diseños que usan esta fórmula" className="border-t border-slate-200 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Diseños que usan esta fórmula
        </h3>
        {designs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin diseños vinculados</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {designs.map((design) => (
              <li key={design.id} className="text-sm text-slate-700">
                <span className="font-medium">{design.name}</span>
                {design.client && <span className="text-slate-500"> · {design.client}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Creation date — es-CO locale, when available. */}
      {pantone?.created_at && (
        <p className="px-4 py-2 text-xs text-slate-400">
          Creado {formatDateTime(pantone.created_at)}
        </p>
      )}

      {/* Actions footer — rendered only when at least one action is provided. */}
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 pt-2 pb-3">
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(pantone) }}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-90 min-h-[44px]"
            >
              Eliminar
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(pantone) }}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[44px]"
            >
              Editar
            </button>
          )}
        </div>
      )}
    </article>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-281c"
      >
        {card}
      </Link>
    )
  }

  return card
}

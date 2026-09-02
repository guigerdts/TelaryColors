// PantoneCard — the central component of the app (FASE4 spec §4, pantone-card
// spec). Redesigned as a clean color swatch (DESIGN.md §10): a solid color
// block (pure color, no text), an info strip with the PANTONE® wordmark + PMS
// code on the left and the copyable HEX on the right, and a compact formula
// preview (first 3 ingredients). The "Diseños que usan esta fórmula" section
// and the creation date moved OUT of the card — they belong on the PantoneDetail
// ficha. The optional `to` prop renders a subtle "Ver detalle →" footer link
// instead of wrapping the whole card (no more nested interactive elements).
//
// Hover elevation follows the /impeccable animate playbook: a vertical
// translate + growing box-shadow through a transition, all motion-safe.
//
// Presentational: the caller supplies `pantone` (code/gamut/hex_color) and the
// already fetched `formula`. Management actions (`onEdit`/`onDelete`) render
// only when the caller passes them — the Pantone management page does; search
// results never do.
import { useState } from 'react'
import { Link } from 'react-router-dom'

const CopyIcon = ({ className = '' }) => (
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
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
)

export default function PantoneCard({ pantone, formula, designs = [], to, onEdit, onDelete }) {
  const code = pantone?.code ?? ''
  const gamut = pantone?.gamut ?? ''
  const pmsCode = `PMS ${code} ${gamut}`.trim()
  const hex = pantone?.hex_color
  const pmsCodeLabel = `Pantone ${pmsCode}`
  const [copied, setCopied] = useState(false)

  const ingredients = formula?.ingredients ?? []
  const preview = ingredients.slice(0, 3)
  const extraCount = ingredients.length - preview.length

  const copyHex = async () => {
    if (!hex) return
    try {
      await navigator.clipboard.writeText(hex.toUpperCase())
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch { /* clipboard not available */ }
  }

  return (
    <article
      role="article"
      className="overflow-hidden rounded-lg border border-border-default bg-surface-raised shadow-xs transition-transform duration-200 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md motion-safe:active:scale-[0.98] motion-safe:active:shadow-md"
    >
      {/* Solid color block — pure card-width color, no text. When no hex is
          assigned, a neutral swatch keeps the block from being mistaken for a
          real color (I9). */}
      {hex ? (
        <div
          role="img"
          aria-label={pmsCodeLabel}
          className="h-24 w-full rounded-t-lg"
          style={{ backgroundColor: hex }}
        />
      ) : (
        <div
          role="img"
          aria-label={`${pmsCodeLabel} — sin color asignado`}
          className="h-24 w-full rounded-t-lg bg-surface-sunken"
        />
      )}

      {/* Info strip — wordmark + PMS code left, copyable HEX right. */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            PANTONE®
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{pmsCode}</p>
        </div>
        {hex ? (
          <div className="flex shrink-0 items-center gap-0.5">
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
              {copied ? '✓' : <CopyIcon className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <span className="shrink-0 text-xs text-text-muted">Sin color asignado</span>
        )}
      </div>

      {/* Formula preview — first 3 ingredients in grams/kilo (design_colors
          dimension), with a "+ N ingredientes más" hint beyond the third. */}
      {ingredients.length > 0 && (
        <section aria-label="Fórmula (g/kg)" className="mt-1 border-t border-border-default px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Fórmula (g/kg)
          </h3>
          <ul className="mt-2 space-y-1">
            {preview.map((ing) => (
              <li
                key={ing.id}
                className="flex items-baseline justify-between gap-2 text-sm text-text-secondary tabular-nums"
              >
                <span className="truncate">{ing.colorant}</span>
                <span className="shrink-0 whitespace-nowrap font-medium text-text-primary">
                  {Number(ing.quantity_g).toFixed(2)} g
                </span>
              </li>
            ))}
          </ul>
          {extraCount > 0 && (
            <p className="mt-2 text-xs text-text-muted">+ {extraCount} ingredientes más</p>
          )}
        </section>
      )}

      {/* Footer — detail link + management actions, rendered only when
          provided. */}
      {(to || onEdit || onDelete) && (
        <div className="flex items-center justify-between gap-2 border-t border-border-default px-4 py-1.5">
          {to ? (
            <Link
              to={to}
              className="inline-flex min-h-[44px] items-center rounded text-sm font-medium text-primary-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            >
              Ver detalle →
            </Link>
          ) : (
            <span />
          )}
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(pantone)}
                  className="rounded bg-error-text px-3 py-1.5 text-xs font-semibold text-text-inverse hover:brightness-90 min-h-[44px]"
                >
                  Eliminar
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(pantone)}
                  className="rounded border border-border-strong px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-sunken min-h-[44px]"
                >
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
// DesignColorPicker — the 1–7 color selector for the Designs page.
//
// ADR-6 enforces the cardinality at the app layer; the UI mirrors it by
// disabling every unselected color once 7 are chosen, so an 8th can never
// be added. Values are controlled locally; the parent reads `value` via the
// onChange callback or reads the exported helper.
import { useState } from 'react'

export const MAX_DESIGN_COLORS = 7

export default function DesignColorPicker({ allColors = [], initial = [], onChange }) {
  const [selected, setSelected] = useState(initial)

  const toggle = (id) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_DESIGN_COLORS
          ? prev
          : [...prev, id]
      if (onChange) onChange(next)
      return next
    })
  }

  const canAdd = selected.length < MAX_DESIGN_COLORS

  return (
    <div className="space-y-2">
      <p aria-live="polite" className="text-sm text-slate-500">
        Colores del diseño: <span className="font-semibold">{selected.length}</span> /{' '}
        {MAX_DESIGN_COLORS}
      </p>
      <div className="flex flex-wrap gap-2">
        {allColors.map((color) => {
          const isSelected = selected.includes(color.id)
          const disabled = !isSelected && !canAdd
          return (
            <button
              key={color.id}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => toggle(color.id)}
              className={`rounded border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? 'border-accent-281c bg-accent-281c text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-accent-281c/40'
              }`}
            >
              {color.code}
            </button>
          )
        })}
      </div>
    </div>
  )
}

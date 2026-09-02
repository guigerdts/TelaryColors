// DesignForm — shared form for creating and editing designs.
// Pure controlled component: receives state + callbacks, renders fields.
// No side effects, no API calls — the parent owns the lifecycle.
// Spanish UI, "El Laboratorio de Precisión".
import DesignColorPicker from './DesignColorPicker.jsx'

export default function DesignForm({
  name,
  onNameChange,
  paintType,
  onPaintTypeChange,
  allColors,
  selectedIds,
  onColorsChange,
  disabled = false,
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wider text-text-muted">
            Nombre <span className="text-error-text">*</span>
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            disabled={disabled}
            className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium uppercase tracking-wider text-text-muted">
            Tipo de pintura
          </span>
          <select
            value={paintType}
            onChange={(e) => onPaintTypeChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="reactiva">reactiva</option>
            <option value="pigmento">pigmento</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <DesignColorPicker
          allColors={allColors}
          initial={selectedIds}
          onChange={onColorsChange}
        />
      </div>
    </>
  )
}

// StatusBadge — shared presentational component for rendering enum status
// values as a colored pill badge. Keeps the status → label/tone mapping in ONE
// place instead of duplicating it across pages. The enum value is always the
// served payload (never recomputed client-side); this component only maps the
// value to display text and tone. Unknown values fall back to the raw value
// with a neutral tone.
const STATUS_LABELS = {
  ok: 'OK',
  bajo_umbral: 'Bajo umbral',
  aprobada: 'Aprobada',
  archivada_reutilizable: 'Archivada (reutilizable)',
  descartada: 'Descartada',
}

const STATUS_STYLES = {
  ok: 'bg-green-100 text-green-800',
  bajo_umbral: 'bg-amber-100 text-amber-800',
  aprobada: 'bg-green-100 text-green-800',
  archivada_reutilizable: 'bg-slate-100 text-slate-600',
  descartada: 'bg-red-100 text-red-700',
}

export default function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

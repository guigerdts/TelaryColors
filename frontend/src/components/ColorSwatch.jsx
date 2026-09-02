// ColorSwatch — small circular swatch for displaying a Pantone color inline.
// Used in design lists, tables, and pickers. Pure presentational component.
//
// Usage:
//   <ColorSwatch code="281 C" hex="#00205B" />
//   <ColorSwatch code="281 C" />  ← shows neutral swatch when no hex
export default function ColorSwatch({ code, hex, size = 'sm', className = '' }) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  }

  const label = hex ? `PMS ${code}` : `PMS ${code} — sin color`

  return (
    <span
      role="img"
      aria-label={label}
      title={`PMS ${code}`}
      className={`inline-block shrink-0 rounded-full border border-border-default ${sizeClasses[size] || sizeClasses.sm} ${className}`}
      style={hex ? { backgroundColor: hex } : undefined}
      {...(!hex && { 'data-no-hex': '' })}
    />
  )
}

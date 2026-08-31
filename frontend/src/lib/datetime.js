// Shared date/time formatter — es-CO locale (Telary Color Spanish UI).
// Returns an empty string for falsy or invalid input.

/**
 * Format an ISO-8601 date string using the es-CO locale.
 * @param {string|null|undefined} isoString
 * @returns {string} Formatted date or empty string.
 */
export function formatDateTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

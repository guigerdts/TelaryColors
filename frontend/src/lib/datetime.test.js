// Shared date/time formatter tests — es-CO locale (Telary Color Spanish UI).
import { describe, expect, it } from 'vitest'

import { formatDateTime } from './datetime.js'

describe('formatDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('')).toBe('')
  })

  it('returns empty string for invalid date', () => {
    expect(formatDateTime('not-a-date')).toBe('')
  })

  it('formats a valid ISO date using es-CO locale', () => {
    // 2026-08-31T18:05:00Z — in es-CO the date part should contain 31/8/2026 or 31/08/2026
    const result = formatDateTime('2026-08-31T18:05:00Z')
    expect(result).toBeTruthy()
    // The date should contain the day (31), month, and year (2026).
    expect(result).toMatch(/31/)
    expect(result).toMatch(/2026/)
  })
})

// Gamut selector (pantone-card spec "Gamut Selector" / FASE4 §6): the create
// forms offer the real gamuts C/TPX/U as options, and any value outside that
// set is rejected — never sent as free text. Kept as a tiny pure module so the
// create/search forms and their unit tests share one source of truth.
import { describe, expect, it } from 'vitest'

import { GAMUT_OPTIONS, isValidGamut } from './gamut.js'

describe('GAMUT_OPTIONS (the real gamuts)', () => {
  it('offers exactly {C, TPX, U} as select options', () => {
    expect(GAMUT_OPTIONS).toEqual(['C', 'TPX', 'U'])
  })

  it.each(['C', 'TPX', 'U'])('accepts the real gamut "%s"', (gamut) => {
    expect(isValidGamut(gamut)).toBe(true)
  })

  it.each(['', 'c', 'coated', 'X', 'TPX ', 'C ', 'u'])(
    'rejects out-of-range gamut "%s"',
    (gamut) => {
      expect(isValidGamut(gamut)).toBe(false)
    },
  )
})

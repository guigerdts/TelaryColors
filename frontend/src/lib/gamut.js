// Gamut selector (pantone-card spec / FASE4 §6): the Pantone create/search
// forms offer the real gamuts already in use — C, TPX, U — as options, never
// free text. Keeping this as a tiny pure module lets the forms and their tests
// share one source of truth; any value outside the set is rejected.
export const GAMUT_OPTIONS = ['C', 'TPX', 'U']

export function isValidGamut(value) {
  return GAMUT_OPTIONS.includes(value)
}

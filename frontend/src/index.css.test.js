// Shared theme contract — spec base "Shared Theme with Brand Accent 281C"
// (design D5). The theme SHALL expose the Pantone 281C brand accent
// (#00205B) as a reusable @theme token so screens can consume
// bg-/text-/border-accent-281c utilities. D5 constrains the token to ACCENT
// use (never a dominant background); that usage rule is reviewed at the
// screen level — this test guards the token's existence and exact value.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')

describe('Shared theme (index.css)', () => {
  it('defines the 281C brand accent token (hex #00205B) inside @theme', () => {
    expect(themeCss).toMatch(/@theme/)
    expect(themeCss).toMatch(/--color-accent-281c:\s*#00205B/i)
  })

  it('keeps the Tailwind entry point intact — the theme stays additive', () => {
    expect(themeCss).toContain('@import "tailwindcss"')
  })
})
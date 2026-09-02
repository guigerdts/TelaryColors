// PantoneCard — the central card (FASE4 spec §4, pantone-card spec). Presents
// a solid color block, a white strip with the PANTONE® wordmark + code+gamut +
// HEX, then the color formula (grams/kilo) and the linked designs/clients as
// SEPARATE sections (design decision D2 / user confirmation: design_colors
// composition vs formula_designs usage are distinct dimensions, never merged).
// Hover elevation is built via the /impeccable animate playbook: a transform
// translateY plus a growing box-shadow through a transition (not a hardcoded
// static shadow).
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PantoneCard from './PantoneCard.jsx'

const PANTONE = { code: '211', gamut: 'C', hex_color: '#E63950' }

const DETAIL = {
  id: 7,
  name: 'Fórmula coral 211',
  ingredients: [
    { id: 1, colorant: 'Blanco', quantity_g: '820.0' },
    { id: 2, colorant: 'Rojo rubí', quantity_g: '130.0' },
  ],
  designs: [
    { id: 11, name: 'Linterna Coral', client: 'Telary Home', notes: null },
    { id: 12, name: 'Vasija Fuego', client: null, notes: null },
  ],
}

describe('PantoneCard (spec §4 visual)', () => {
  it('renders color block, PANTONE® wordmark, code+gamut and HEX', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />
      </MemoryRouter>,
    )

    // Solid color block at the top (full card width representation).
    const block = screen.getByRole('img', { name: 'Pantone PMS 211 C' })
    expect(block).toBeTruthy()
    // The block carries the color: the block element expresses it via a
    // background style derived from the supply hex. jsdom normalizes the color
    // to its computed rgb() form, so assert against that representation.
    const bg = block.style.backgroundColor || block.style.background
    expect(bg).toMatch(/230,\s*57,\s*80/) // rgb of #E63950

    // Wordmark + code with gamut + HEX on the white strip.
    expect(screen.getByText('PANTONE®')).toBeTruthy()
    expect(screen.getByText('PMS 211 C')).toBeTruthy()
    expect(screen.getByText('#E63950')).toBeTruthy()
  })

  it('renders the formula with each colorant in grams/kilo', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />
      </MemoryRouter>,
    )

    const formulaSection = screen.getByRole('region', { name: 'Fórmula (g/kg)' })
    expect(within(formulaSection).getByText(/Blanco/)).toBeTruthy()
    expect(within(formulaSection).getByText(/Rojo rubí/)).toBeTruthy()
  })

  it('does NOT render the linked designs section (it moved to PantoneDetail)', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />
      </MemoryRouter>,
    )

    // The "Diseños que usan esta fórmula" dimension is no longer on the card —
    // the PantoneDetail ficha owns it. The card stays a compact color swatch.
    expect(screen.queryByRole('region', { name: 'Diseños que usan esta fórmula' })).toBeNull()
    expect(screen.queryByText('Linterna Coral')).toBeNull()
    expect(screen.queryByText(/Telary Home/)).toBeNull()
    // The formula still renders for the same supply.
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
  })

  it('renders the formula preview even when no designs are supplied', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} designs={[]} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('region', { name: 'Diseños que usan esta fórmula' })).toBeNull()
    const formulaSection = screen.getByRole('region', { name: 'Fórmula (g/kg)' })
    expect(within(formulaSection).getByText(/Blanco/)).toBeTruthy()
  })

  it('renders placeholder text when hex_color is null', () => {
    const pantoneNoHex = { code: '211', gamut: 'C', hex_color: null }
    render(
      <MemoryRouter>
        <PantoneCard pantone={pantoneNoHex} formula={DETAIL} designs={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Sin color asignado')).toBeTruthy()
    // Should NOT show a hex code.
    expect(screen.queryByText('#E63950')).toBeNull()
  })

  it('does NOT render the creation date (it moved to PantoneDetail)', () => {
    const pantoneWithDate = { ...PANTONE, created_at: '2026-08-31T18:05:00Z' }
    render(
      <MemoryRouter>
        <PantoneCard pantone={pantoneWithDate} formula={DETAIL} designs={[]} />
      </MemoryRouter>,
    )

    // The card is a clean color swatch — the creation date is ficha territory.
    expect(screen.queryByText(/Creado/)).toBeNull()
  })

  it('guards hover/active motion behind motion-safe so it respects prefers-reduced-motion', () => {
    // Phase A flagged the card as animating on hover while ignoring the OS
    // reduce-motion preference. Regression: the lift/scale must be expressed
    // with the motion-safe: variant (and never a bare hover:/active: that a
    // reduced-motion user cannot opt out of globally).
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} designs={[]} />
      </MemoryRouter>,
    )

    const card = screen.getByRole('article')
    const cls = card.className
    expect(cls).toMatch(/motion-safe:hover:-translate-y-1/)
    expect(cls).toMatch(/motion-safe:active:scale-\[0\.98\]/)
    // No unprotected hover/active motion: these would run even under reduce.
    // Use a lookbehind so `motion-safe:hover:…` is NOT flagged as a bare hover.
    expect(cls).not.toMatch(/(?<!motion-safe:)hover:-translate-y-1/)
    expect(cls).not.toMatch(/(?<!motion-safe:)hover:shadow-lg/)
    expect(cls).not.toMatch(/(?<!motion-safe:)active:scale-\[0\.98\]/)
  })

  it('renders as a link when to prop is provided', () => {
    render(
      <MemoryRouter>
        <PantoneCard to="/pantone/5" pantone={PANTONE} formula={DETAIL} designs={[]} />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pantone/5')
  })

  it('does NOT render as a link when to prop is absent', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} designs={[]} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link')).toBeNull()
  })
})

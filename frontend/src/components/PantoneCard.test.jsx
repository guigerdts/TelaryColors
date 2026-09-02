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

  it('sets color block background from hex_color', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} />
      </MemoryRouter>,
    )

    const block = screen.getByRole('img', { name: 'Pantone PMS 211 C' })
    const bg = block.style.backgroundColor || block.style.background
    expect(bg).toMatch(/230,\s*57,\s*80/) // rgb of #E63950
  })

  it('shows fallback when hex_color is absent', () => {
    const pantoneNoHex = { code: '211', gamut: 'C' }
    render(
      <MemoryRouter>
        <PantoneCard pantone={pantoneNoHex} formula={DETAIL} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Sin color asignado')).toBeTruthy()
    expect(screen.queryByText('#E63950')).toBeNull()
  })

  it('copies hex to clipboard on copy button click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} />
      </MemoryRouter>,
    )

    const copyBtn = screen.getByRole('button', { name: /copiar #E63950/i })
    await copyBtn.click()

    expect(writeText).toHaveBeenCalledWith('#E63950')

    vi.unstubAllGlobals()
  })

  it('shows first 3 ingredients and overflow count for 5-ingredient formula', () => {
    const bigFormula = {
      id: 99,
      name: 'Big formula',
      ingredients: [
        { id: 1, colorant: 'A', quantity_g: '100.0' },
        { id: 2, colorant: 'B', quantity_g: '200.0' },
        { id: 3, colorant: 'C', quantity_g: '300.0' },
        { id: 4, colorant: 'D', quantity_g: '400.0' },
        { id: 5, colorant: 'E', quantity_g: '500.0' },
      ],
    }

    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={bigFormula} />
      </MemoryRouter>,
    )

    const formulaSection = screen.getByRole('region', { name: 'Fórmula (g/kg)' })
    expect(within(formulaSection).getByText('A')).toBeTruthy()
    expect(within(formulaSection).getByText('B')).toBeTruthy()
    expect(within(formulaSection).getByText('C')).toBeTruthy()
    // D and E should NOT be shown
    expect(within(formulaSection).queryByText('D')).toBeNull()
    expect(within(formulaSection).queryByText('E')).toBeNull()
    expect(within(formulaSection).getByText(/\+\s*2 ingredientes más/)).toBeTruthy()
  })

  it('renders "Ver detalle" link when to prop is provided', () => {
    render(
      <MemoryRouter>
        <PantoneCard to="/pantone/1" pantone={PANTONE} formula={DETAIL} />
      </MemoryRouter>,
    )

    const link = screen.getByText(/Ver detalle/)
    expect(link).toHaveAttribute('href', '/pantone/1')
  })

  it('does NOT render "Ver detalle" link when to prop is absent', () => {
    render(
      <MemoryRouter>
        <PantoneCard pantone={PANTONE} formula={DETAIL} />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/Ver detalle/)).toBeNull()
  })
})

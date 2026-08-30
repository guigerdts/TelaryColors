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

import PantoneCard from './PantoneCard.jsx'

const PANTONE = { code: '211', gamut: 'C', hex: '#E63950' }

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
    render(<PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />)

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
    render(<PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />)

    const formulaSection = screen.getByRole('region', { name: 'Fórmula (g/kg)' })
    expect(within(formulaSection).getByText(/Blanco/)).toBeTruthy()
    expect(within(formulaSection).getByText(/Rojo rubí/)).toBeTruthy()
  })

  it('renders linked designs/clients in a SEPARATE section from the formula', () => {
    render(<PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />)

    const designsSection = screen.getByRole('region', { name: 'Diseños que usan esta fórmula' })
    expect(designsSection).toBeTruthy()
    expect(within(designsSection).getByText('Linterna Coral')).toBeTruthy()
    expect(within(designsSection).getByText(/Telary Home/)).toBeTruthy()

    // The two dimensions are NOT merged: the formula colorants must not appear
    // inside the designs section (confirmation user 1 / design D2).
    expect(within(designsSection).queryByText(/Blanco/)).toBeNull()
    expect(within(designsSection).queryByText(/Rojo rubí/)).toBeNull()

    // Both distinct section headings are present.
    expect(screen.getByRole('region', { name: 'Fórmula (g/kg)' })).toBeTruthy()
  })

  it('shows the designs section as empty (visible, not collapsed) when there are no designs', () => {
    render(<PantoneCard pantone={PANTONE} formula={DETAIL} designs={[]} />)

    const designsSection = screen.getByRole('region', { name: 'Diseños que usan esta fórmula' })
    expect(within(designsSection).getByText(/Sin diseños vinculados/)).toBeTruthy()
    // Formula still renders, and it lives outside the empty designs section.
    const formulaSection = screen.getByRole('region', { name: 'Fórmula (g/kg)' })
    expect(within(formulaSection).getByText(/Blanco/)).toBeTruthy()
  })

  it('elevates on hover via a transform + growing shadow (impeccable animate)', () => {
    render(<PantoneCard pantone={PANTONE} formula={DETAIL} designs={DETAIL.designs} />)

    const card = screen.getByRole('article')
    const cls = card.className
    // Both halves of the elevation recipe, built through /impeccable animate:
    // a vertical translate (transform) plus a growing shadow, with a transition
    // joining them. Tested at the class contract because jsdom cannot evaluate
    // Tailwind's generated CSS.
    expect(cls).toMatch(/hover:-translate-y-/)
    expect(cls).toMatch(/hover:shadow/)
    expect(cls).toMatch(/transition/)
  })
})

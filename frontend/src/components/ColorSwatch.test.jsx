import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import ColorSwatch from './ColorSwatch.jsx'

describe('ColorSwatch', () => {
  it('renders with hex color and accessible label', () => {
    render(<ColorSwatch code="281 C" hex="#00205B" />)
    const swatch = screen.getByRole('img', { name: /PMS 281 C/i })
    expect(swatch).toBeTruthy()
    expect(swatch.style.backgroundColor).toBe('rgb(0, 32, 91)')
  })

  it('renders neutral swatch when no hex provided', () => {
    render(<ColorSwatch code="281 C" />)
    const swatch = screen.getByRole('img', { name: /sin color/i })
    expect(swatch).toBeTruthy()
    expect(swatch.style.backgroundColor).toBe('')
  })

  it('applies size class', () => {
    const { rerender } = render(<ColorSwatch code="281 C" hex="#00205B" size="lg" />)
    const swatch = screen.getByRole('img')
    expect(swatch.className).toContain('h-10')

    rerender(<ColorSwatch code="281 C" hex="#00205B" size="xs" />)
    expect(screen.getByRole('img').className).toContain('h-3')
  })
})

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DesignColorPicker, { MAX_DESIGN_COLORS } from './DesignColorPicker.jsx'

const makeColors = (ids) => ids.map((id) => ({ id, code: `P-${id}` }))

// The counter paragraph is "Colores del diseño: <span>N</span> / 7". Its full
// textContent ("Colores del diseño: N / 7") is the stable, single-node signal:
// querying by textContent from an ancestor also matches the wrapping <div>, and
// an unanchored number regex matches both the count and the max.
const counterIs = (n, max = MAX_DESIGN_COLORS) => {
  const p = screen.getByText((_, el) => el.tagName === 'P' && el.textContent.includes('Colores del diseño'))
  expect(p).toHaveTextContent(new RegExp(`[:\\s]${n} / ${max}`))
}

describe('DesignColorPicker (1–7 cardinality)', () => {
  it('allows selecting a color up to the 7th', () => {
    render(
      <DesignColorPicker allColors={makeColors([1, 2, 3, 4, 5, 6, 7, 8])} initial={[1, 2, 3, 4, 5, 6]} />,
    )

    counterIs(6)
    const color7 = screen.getByRole('button', { name: /^P-7$/ })
    expect(color7).toBeEnabled()
  })

  it('disables adding an 8th color once 7 are selected', () => {
    render(
      <DesignColorPicker allColors={makeColors([1, 2, 3, 4, 5, 6, 7, 8])} initial={[1, 2, 3, 4, 5, 6, 7]} />,
    )

    counterIs(7)

    // The unselected 8th color cannot be added.
    const color8 = screen.getByRole('button', { name: /^P-8$/ })
    expect(color8).toBeDisabled()
  })

  it('blocks selecting an 8th color after the user selects 7', async () => {
    const user = userEvent.setup()
    render(
      <DesignColorPicker allColors={makeColors([1, 2, 3, 4, 5, 6, 7, 8])} initial={[1, 2, 3, 4, 5, 6]} />,
    )

    // Selecting the 7th color saturates the 1–7 budget.
    await user.click(screen.getByRole('button', { name: /^P-7$/ }))
    counterIs(7)

    // The 8th is now disabled — cannot add an 8th.
    const color8 = screen.getByRole('button', { name: /^P-8$/ })
    expect(color8).toBeDisabled()
  })
})

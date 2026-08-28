import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import App from './App.jsx'

describe('App shell', () => {
  it('renders the Telary Color product heading', () => {
    render(<App />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Telary Color')
  })
})
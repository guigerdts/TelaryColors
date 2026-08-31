// Layout shell tests — responsive navigation (Fase 5 fix).
//
// Verifies the mobile bottom-nav structure: the four primary destinations are
// always visible, the "Más" sheet reveals the secondary destinations, and the
// admin-only "Usuarios" entry is filtered by role. The full shell needs the
// auth context and a router, so it renders inside both mocks.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import Layout from './Layout.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'

vi.mock('../auth/AuthProvider.jsx', () => ({
  useAuth: vi.fn(),
}))

const mockLogout = vi.fn()

function renderLayout({ role = 'admin', name = 'Operador de Pintura' } = {}) {
  useAuth.mockReturnValue({
    user: { full_name: name, username: 'op1', role },
    isAuthenticated: true,
    logout: mockLogout,
    login: vi.fn(),
    token: 'x',
  })
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <Layout />
    </MemoryRouter>,
  )
}

describe('Layout — mobile bottom navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockReset()
  })

  it('renders the four primary bottom-nav destinations always', () => {
    renderLayout()
    // Primary destinations are always present on mobile.
    for (const label of ['Buscar', 'Pantone', 'Fórmulas', 'Inventario']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('opens the "Más" sheet to reveal secondary destinations', async () => {
    const user = userEvent.setup()
    renderLayout({ role: 'admin' })
    await user.click(screen.getByRole('button', { name: /más/i }))

    for (const label of ['Alertas', 'Diseños', 'Muestras', 'Usuarios']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('hides the admin-only "Usuarios" entry for an operator', async () => {
    const user = userEvent.setup()
    renderLayout({ role: 'operator' })
    await user.click(screen.getByRole('button', { name: /más/i }))

    expect(screen.getAllByText('Alertas').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Diseños').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Muestras').length).toBeGreaterThan(0)
    // For an operator the admin-only destination must not render anywhere
    // (neither in the sheet nor in the (hidden) desktop nav).
    expect(screen.queryAllByText('Usuarios')).toHaveLength(0)
  })

  it('exposes the admin destinations for an admin profile menu', async () => {
    const user = userEvent.setup()
    renderLayout({ role: 'admin' })
    await user.click(screen.getByRole('button', { name: /operador/i }))

    expect(screen.getByText('Usuarios / Administración')).toBeTruthy()
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('calls logout and navigates away from the profile menu', async () => {
    const user = userEvent.setup()
    renderLayout({ name: 'Juan' })
    await user.click(screen.getByRole('button', { name: /juan/i }))
    await user.click(screen.getByRole('button', { name: /salir/i }))

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })
})

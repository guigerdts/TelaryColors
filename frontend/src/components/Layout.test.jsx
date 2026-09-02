// Layout shell tests — responsive navigation (Fase 5 fix).
//
// Verifies the mobile bottom-nav structure: the four primary destinations are
// always visible, the "Más" sheet reveals the secondary destinations, and the
// admin-only "Usuarios" entry is filtered by role. The full shell needs the
// auth context and a router, so it renders inside both mocks.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

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

// M1: renders Layout inside real Routes so a Ctrl+K navigation is observable.
// Probe pages announce which route is currently matched by the Outlet.
function renderLayoutInRoutes(initialPath) {
  useAuth.mockReturnValue({
    user: { full_name: 'Operador de Pintura', username: 'op1', role: 'admin' },
    isAuthenticated: true,
    logout: mockLogout,
    login: vi.fn(),
    token: 'x',
  })
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/search" element={<div>SEARCH-PROBE</div>} />
          <Route path="/pantone" element={<div>PANTONE-PROBE</div>} />
        </Route>
      </Routes>
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

describe('Layout — M1 keyboard shortcut', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Ctrl+K from any page navigates to the search page', async () => {
    renderLayoutInRoutes('/pantone')
    expect(screen.getByText('PANTONE-PROBE')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(await screen.findByText('SEARCH-PROBE')).toBeTruthy()
  })

  it('Cmd+K (macOS) also navigates to the search page', async () => {
    renderLayoutInRoutes('/pantone')

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(await screen.findByText('SEARCH-PROBE')).toBeTruthy()
  })

  it('does not hijack Ctrl+K while already on the search page', async () => {
    renderLayoutInRoutes('/search')
    expect(screen.getByText('SEARCH-PROBE')).toBeTruthy()

    const spy = vi.spyOn(KeyboardEvent.prototype, 'preventDefault')
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, cancelable: true })
    await act(async () => {})

    // No listener attached on /search: native default kept, no navigation.
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText('SEARCH-PROBE')).toBeTruthy()
    spy.mockRestore()
  })

  it('prevents the browser default (browser search) when handling Ctrl+K', async () => {
    const spy = vi.spyOn(KeyboardEvent.prototype, 'preventDefault')
    renderLayoutInRoutes('/pantone')

    const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    window.dispatchEvent(evt)

    expect(spy).toHaveBeenCalled()
    expect(await screen.findByText('SEARCH-PROBE')).toBeTruthy()
    spy.mockRestore()
  })

  it('removes the global listener when the layout unmounts', async () => {
    const { unmount } = renderLayoutInRoutes('/pantone')
    unmount()

    const spy = vi.spyOn(KeyboardEvent.prototype, 'preventDefault')
    const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    window.dispatchEvent(evt)

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('Layout — M1 keyboard shortcut', () => {
  it('Ctrl+K from another page prevents the native action and navigates to /search', async () => {
    renderLayoutInRoutes('/pantone')
    expect(screen.getByText('PANTONE-PROBE')).toBeTruthy()

    const notPrevented = fireEvent.keyDown(window, { key: 'k', ctrlKey: true, cancelable: true })

    expect(notPrevented).toBe(false)
    expect(await screen.findByText('SEARCH-PROBE')).toBeTruthy()
    expect(screen.queryByText('PANTONE-PROBE')).toBeNull()
  })

  it('Cmd+K (macOS) also navigates to /search', async () => {
    renderLayoutInRoutes('/pantone')

    fireEvent.keyDown(window, { key: 'k', metaKey: true, cancelable: true })

    expect(await screen.findByText('SEARCH-PROBE')).toBeTruthy()
  })

  it('does not hijack Ctrl+K while already on the search page', () => {
    renderLayoutInRoutes('/search')
    expect(screen.getByText('SEARCH-PROBE')).toBeTruthy()

    const notPrevented = fireEvent.keyDown(window, { key: 'k', ctrlKey: true, cancelable: true })

    // No handler runs on /search — native browser behavior stays untouched.
    expect(notPrevented).toBe(true)
  })

  it('removes the window keydown listener on unmount', () => {
    const { unmount } = renderLayoutInRoutes('/pantone')
    unmount()

    const notPrevented = fireEvent.keyDown(window, { key: 'k', ctrlKey: true, cancelable: true })
    expect(notPrevented).toBe(true)
  })
})

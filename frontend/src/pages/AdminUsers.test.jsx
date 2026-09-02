// Admin Users page — Spanish UI. Admin-only user listing, creation, and role
// changes. A role change is a sensitive action: it runs only after the operator
// confirms in an ARIA ConfirmDialog and surfaces visible error feedback if it
// fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

import AdminUsersPage from './AdminUsers.jsx'

const USERS = [
  { id: 1, username: 'ana', full_name: 'Ana', role: 'operator', last_access_at: null },
  { id: 2, username: 'bob', full_name: null, role: 'admin', last_access_at: null },
]

const okJson = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body })

describe('AdminUsersPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/users') && method === 'GET') return okJson(USERS)
      if (String(url).includes('/access-logs') && method === 'GET') return okJson([])
      if (String(url).includes('/users/') && method === 'PATCH') return okJson({})
      return okJson([])
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the user list with role selects', async () => {
    render(<AdminUsersPage />)
    await act(async () => {})
    expect(screen.getByText('ana')).toBeTruthy()
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2)

    // Each row's role select carries an accessible name for screen readers (P1).
    const anaRow = screen.getByText('ana').closest('tr')
    expect(within(anaRow).getAllByRole('combobox')[0]).toHaveAccessibleName('Rol de ana')
  })

  it('does NOT change the role until the operator confirms in the dialog', async () => {
    render(<AdminUsersPage />)
    await act(async () => {})

    // Change ana's role select to admin.
    const anaRow = screen.getByText('ana').closest('tr')
    fireEvent.change(within(anaRow).getAllByRole('combobox')[0], { target: { value: 'admin' } })
    await act(async () => {})

    // A confirmation dialog opens and no PATCH was fired yet.
    expect(screen.getByRole('dialog')).toBeTruthy()
    const patch = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/users/1'),
    )
    expect(patch).toBeUndefined()
  })

  it('updates the role only after confirming, then shows success feedback', async () => {
    render(<AdminUsersPage />)
    await act(async () => {})

    const anaRow = screen.getByText('ana').closest('tr')
    fireEvent.change(within(anaRow).getAllByRole('combobox')[0], { target: { value: 'admin' } })
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await act(async () => {})

    const patch = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'PATCH' && String(url).includes('/users/1'),
    )
    expect(patch).toBeTruthy()
    expect(screen.getByText('Rol actualizado')).toBeTruthy()
  })

  it('shows visible error feedback when a confirmed role change fails', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/users') && method === 'GET') return okJson(USERS)
      if (String(url).includes('/access-logs') && method === 'GET') return okJson([])
      if (String(url).includes('/users/') && method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({ detail: 'No autorizado para cambiar roles' }) })
      }
      return okJson([])
    })
    render(<AdminUsersPage />)
    await act(async () => {})

    const anaRow = screen.getByText('ana').closest('tr')
    fireEvent.change(within(anaRow).getAllByRole('combobox')[0], { target: { value: 'admin' } })
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await act(async () => {})

    expect(screen.getByText(/no autorizado/i)).toBeTruthy()
  })
})

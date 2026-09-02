// Designs page — Spanish UI. Creating a design stages through an ARIA
// ConfirmDialog (P1 fix): the POST /designs request runs only after the
// operator confirms, mirroring the Formulas page pattern.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DesignsPage from './Designs.jsx'

const DESIGNS = [
  { id: 1, name: 'Colección Aromo', paint_type: 'reactiva', colors: [{ id: 10 }, { id: 11 }] },
]

describe('DesignsPage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (String(url).includes('/designs') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 2, ...JSON.parse(init.body) }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stages the create behind a confirmation dialog — no POST before confirm (P1)', async () => {
    render(<DesignsPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})

    // The dialog is open and no create request has been fired yet.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy()
    const post = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/designs'),
    )
    expect(post).toBeUndefined()
  })

  it('creates the design only after confirming in the dialog', async () => {
    render(<DesignsPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    const post = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/designs'),
    )
    expect(post).toBeTruthy()
    const body = JSON.parse(post[1].body)
    expect(body.name).toBe('Colección Aurora')
    expect(body.paint_type).toBe('reactiva')
    expect(screen.getByText('Diseño creado')).toBeTruthy()
  })

  it('cancels the dialog without creating anything', async () => {
    render(<DesignsPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await act(async () => {})

    expect(screen.queryByRole('dialog')).toBeNull()
    const post = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/designs'),
    )
    expect(post).toBeUndefined()
  })

  it('surfaces the backend error verbatim after a failed confirm', async () => {
    fetchMock.mockImplementation((url, init) => {
      const method = init?.method ?? 'GET'
      if (String(url).includes('/pantone-colors') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      if (String(url).includes('/designs') && method === 'GET') {
        return Promise.resolve({ ok: true, status: 200, json: async () => DESIGNS })
      }
      if (String(url).includes('/designs') && method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({ detail: 'Se requieren entre 1 y 7 colores' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })

    render(<DesignsPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Colección Aurora' } })
    fireEvent.click(screen.getByRole('button', { name: /crear diseño/i }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    // The exact backend detail string must appear in the UI — NOT a generic error.
    expect(screen.getByText('Se requieren entre 1 y 7 colores')).toBeTruthy()
    // Dialog closes again on failure so the operator can adjust the form.
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
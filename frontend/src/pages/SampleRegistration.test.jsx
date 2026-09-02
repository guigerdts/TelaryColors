// SampleRegistration page — Spanish UI. Mobile-first: pick a Pantone target,
// optionally attach a rear-camera photo, choose a status and save. Photo is
// OPTIONAL (design ADR-6 / spec "Optional Photo"). All controls live on ONE
// screen so the journey resolves in at most a few taps.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import SampleRegistrationPage from './SampleRegistration.jsx'

const COLORS = [
  { id: 1, code: '221 C', gamut: 'C', paint_type: 'reactiva' },
  { id: 2, code: '2210 U', gamut: 'U', paint_type: 'pigmento' },
]

describe('SampleRegistrationPage (mobile-first, ≤3 taps)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    // Clear the cross-test call history so per-test `.find()` assertions only
    // see the current test's requests (implementations are re-registered fresh).
    fetchMock.mockClear()
    fetchMock.mockImplementation((url, init) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.includes('/samples') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 5, ...JSON.parse(init.body) }),
        })
      }
      // Default: the Pantone list the target <select> loads on mount.
      return Promise.resolve({ ok: true, status: 200, json: async () => COLORS })
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows pantone target, optional photo, status, and save on a single screen', async () => {
    render(<SampleRegistrationPage />)
    await act(async () => {})

    // Target selector is populated from the Pantone list.
    expect(screen.getByLabelText(/color pantone/i)).toBeTruthy()
    // Status selector present (defaults to the reusable-archived status).
    expect(screen.getByLabelText(/estado/i)).toBeTruthy()
    // Save control is on the same screen — no wizard steps.
    expect(screen.getByRole('button', { name: /registrar/i })).toBeTruthy()
  })

  it('treats the photo as optional but configured to capture with the rear camera', async () => {
    render(<SampleRegistrationPage />)
    await act(async () => {})

    const photo = screen.getByLabelText(/foto/i)
    expect(photo.type).toBe('file')
    // Not required — a sample can be registered without an attached photo.
    expect(photo).not.toHaveAttribute('required')
    // Rear-camera hint so the mobile browser opens the back camera.
    expect(photo).toHaveAttribute('capture', 'environment')
  })

  it('creates a sample without a photo when the user skips it (photo optional)', async () => {
    render(<SampleRegistrationPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/color pantone/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})

    // A confirmation dialog opens; the sample is NOT POSTed yet.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(
      fetchMock.mock.calls.some(([url, init]) => init?.method === 'POST' && String(url).includes('/samples')),
    ).toBe(false)

    // Confirm in the dialog to complete the save.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    // A sample is POSTed even though no photo was chosen.
    const saveCall = fetchMock.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).includes('/samples'))
    expect(saveCall).toBeTruthy()
    const [, init] = saveCall
    const body = JSON.parse(init.body)
    expect(body.pantone_target_id).toBe(1)
    // No photo -> null photo_url (spec "Create without photo" scenario), and
    // the upload endpoint must not have been hit for this photo-less create.
    expect(body.photo_url).toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/samples/upload'))).toBe(false)
  })

  it('uploads the chosen photo and links it to the created sample', async () => {
    const file = new File(['bytes'], 'foto.jpg', { type: 'image/jpeg' })
    fetchMock.mockImplementation((url, init) => {
      const u = String(url)
      const method = init?.method ?? 'GET'
      if (u.includes('/samples/upload')) {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ photo_url: '/uploads/shot.jpg' }) })
      }
      if (u.includes('/samples') && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 7, ...JSON.parse(init.body) }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => COLORS })
    })

    render(<SampleRegistrationPage />)
    await act(async () => {})

    fireEvent.change(screen.getByLabelText(/color pantone/i), { target: { value: '1' } })
    await act(async () => {})
    fireEvent.change(screen.getByLabelText(/foto/i), { target: { files: [file] } })
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }))
    await act(async () => {})
    // Confirm in the dialog to complete the save.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await act(async () => {})

    // Photo path ran: upload first, then create carried the returned photo_url.
    const uploadCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/samples/upload'))
    expect(uploadCall).toBeTruthy()
    expect(uploadCall[1].body).toBeInstanceOf(FormData)
    const saveCall = fetchMock.mock.calls.find(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/samples') && !String(url).includes('/upload'),
    )
    expect(saveCall).toBeTruthy()
    expect(JSON.parse(saveCall[1].body).photo_url).toBe('/uploads/shot.jpg')
  })

  it('keeps the register action off until a target is chosen, so the flow needs few taps', async () => {
    render(<SampleRegistrationPage />)
    await act(async () => {})

    // No target yet -> cannot save yet (single-gate keeps the journey short).
    expect(screen.getByRole('button', { name: /registrar/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/color pantone/i), { target: { value: '2' } })
    await act(async () => {})
    expect(screen.getByRole('button', { name: /registrar/i })).toBeEnabled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch, setUnauthorizedHandler } from './client.js'
import { listReusableSamples, promoteSample } from './index.js'
import { clearToken, getToken, setToken } from '../auth/store.js'

describe('api client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    clearToken()
    setUnauthorizedHandler(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches the Authorization Bearer header from the stored token', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })

    const res = await apiFetch('/pantone-colors')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/pantone-colors')
    expect(init.headers.Authorization).toBe('Bearer jwt-abc')
    expect(init.method).toBe('GET')
    expect(res.status).toBe(200)
  })

  it('clears the stored token when the API answers 401', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Sesión expirada' }),
    })

    await expect(apiFetch('/pantone-colors')).rejects.toThrow()

    expect(getToken()).toBeNull()
  })

  it('invokes the unauthorized handler (redirect to login) on a 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Sesión expirada' }),
    })

    await expect(apiFetch('/pantone-colors')).rejects.toThrow()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('sends JSON bodies with the content-type header', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 1 }) })

    await apiFetch('/pantone-colors', { method: 'POST', body: { code: '221 C', gamut: 'C', paint_type: 'reactiva' } })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body).code).toBe('221 C')
  })

  it('listReusableSamples fetches by target pantone via query params', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })

    await listReusableSamples(7)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/samples?pantone_target_id=7&status=archivada_reutilizable')
  })

  it('listReusableSamples interpolates each target id (not a constant)', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })

    await listReusableSamples(42)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/samples?pantone_target_id=42&status=archivada_reutilizable')
  })

  it('uploadSamplePhoto posts multipart FormData and never a JSON content-type', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ photo_url: '/uploads/shot.jpg' }) })

    const file = new File(['bytes'], 'foto.jpg', { type: 'image/jpeg' })
    // Dynamic import keeps the rest of this file loadable while the export
    // is still missing during the RED step.
    const { uploadSamplePhoto } = await import('./index.js')

    const res = await uploadSamplePhoto(file)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/samples/upload')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    // The body must be raw FormData — fetch derives the multipart boundary,
    // so we must NOT set a JSON content-type on it.
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('file')).toBe(file)
    expect(init.headers['Content-Type']).toBeUndefined()
    expect(res.photo_url).toBe('/uploads/shot.jpg')
  })

  it('uploadSamplePhoto still attaches the Bearer token', async () => {
    setToken('jwt-xyz')
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ photo_url: '/uploads/shot.jpg' }) })

    const file = new File(['bytes'], 'foto.jpg', { type: 'image/jpeg' })
    const { uploadSamplePhoto } = await import('./index.js')

    await uploadSamplePhoto(file)

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer jwt-xyz')
  })

  it('promoteSample POSTs to /samples/{id}/promote with the formula payload', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ formula: { id: 9 }, sample: { id: 100, status: 'aprobada', formula_id: 9 } }),
    })

    const res = await promoteSample(100, {
      name: 'Fórmula promovida',
      ingredients: [{ colorant: 'Amarillo', quantity: '10', unit: 'g' }],
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/samples/100/promote')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).name).toBe('Fórmula promovida')
    expect(JSON.parse(init.body).ingredients).toHaveLength(1)
    expect(res.sample.status).toBe('aprobada')
  })

  it('promoteSample interpolates the sample id (not a constant)', async () => {
    setToken('jwt-abc')
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ formula: {}, sample: {} }) })

    await promoteSample(42, { name: 'Otra', ingredients: [] })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/samples/42/promote')
  })
})

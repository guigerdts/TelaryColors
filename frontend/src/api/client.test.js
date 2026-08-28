import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch, setUnauthorizedHandler } from './client.js'
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
})

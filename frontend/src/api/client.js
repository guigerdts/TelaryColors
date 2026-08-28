// Typed-ish API client over the relative /api/v1/* surface.
//
// Single-origin deployment (design ADR-2): the browser and the API share one
// origin — /api/v1 in prod (FastAPI serves the SPA), proxied to :8000 in dev
// (vite.config.js). Every request attaches `Authorization: Bearer <token>`;
// on a 401 the stored token is cleared and the app is sent to /login.
import { clearToken, getToken } from '../auth/store.js'

export const API_BASE = '/api/v1'

// Injectable unauthorized redirect, so tests can assert navigation without
// touching window.location. Defaults to a hard login redirect.
let unauthorizedHandler = null

/** Override how a 401 is handled (tests inject a spy; login wires it). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

async function readErrorDetail(res) {
  try {
    const data = await res.json()
    return data && typeof data.detail === 'string' ? data.detail : 'Error'
  } catch {
    return 'Error'
  }
}

/**
 * Perform a relative /api/v1 request with Bearer auth + JSON handling.
 * Throws an Error carrying the Spanish `detail` on any non-2xx response.
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    if (unauthorizedHandler) unauthorizedHandler()
    else window.location.assign('/login')
    const detail = await readErrorDetail(res)
    throw new Error(detail || 'Sesión expirada')
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res)
    throw new Error(detail)
  }

  // 204 No Content — nothing to parse.
  if (res.status === 204) return res
  return res
}

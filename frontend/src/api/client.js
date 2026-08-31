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

// Returns a useful Spanish message for a non-2xx response.
//  - A string `detail` (our 4xx responses) is shown verbatim.
//  - A FastAPI 422 returns `detail` as an array of validation errors; fold the
//    decent ones into a readable summary instead of dropping to a bare "Error".
//  - A 5xx or an unparseable body (e.g. an internal 500 with no JSON detail)
//    falls back to a server-side message so the user is never left staring at
//    the literal word "Error" with no clue it came from the backend.
async function readErrorDetail(res, status) {
  try {
    const data = await res.json()
    if (data?.detail && typeof data.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      const messages = data.detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .slice(0, 3)
      if (messages.length) return messages.join('. ')
    }
  } catch {
    // fall through to the status-based default below
  }
  if (status >= 500) return 'Ocurrió un error en el servidor, intenta de nuevo'
  return 'No se pudo completar la solicitud'
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
    const detail = await readErrorDetail(res, res.status)
    throw new Error(detail || 'Sesión expirada')
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res, res.status)
    throw new Error(detail)
  }

  // 204 No Content — nothing to parse.
  if (res.status === 204) return res
  return res
}

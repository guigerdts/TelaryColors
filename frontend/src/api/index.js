// Endpoint helpers over the shared /api/v1 client (see client.js).
import { apiFetch } from './client.js'

// --- Auth ---
export async function login(username, password) {
  // OAuth2 password form (auth spec): application/x-www-form-urlencoded.
  const body = new URLSearchParams({ username, password })
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    let detail = 'Usuario o contraseña incorrectos'
    try {
      const data = await res.json()
      if (data && typeof data.detail === 'string') detail = data.detail
    } catch {
      /* keep default */
    }
    throw new Error(detail)
  }
  return res.json() // { access_token, token_type, user }
}

export async function me() {
  const res = await apiFetch('/auth/me')
  return res.json()
}

// --- Users (admin) ---
export const listUsers = () => apiFetch('/users').then((r) => r.json())
export const createUser = (payload) => apiFetch('/users', { method: 'POST', body: payload }).then((r) => r.json())
export const updateUser = (id, payload) => apiFetch(`/users/${id}`, { method: 'PATCH', body: payload }).then((r) => r.json())

// --- Pantone colors ---
export const searchPantone = (q) => apiFetch(`/pantone-colors?q=${encodeURIComponent(q)}`).then((r) => r.json())
export const listPantone = () => apiFetch('/pantone-colors').then((r) => r.json())
export const createPantone = (payload) => apiFetch('/pantone-colors', { method: 'POST', body: payload }).then((r) => r.json())
export const updatePantone = (id, payload) => apiFetch(`/pantone-colors/${id}`, { method: 'PATCH', body: payload }).then((r) => r.json())
export const deletePantone = (id) => apiFetch(`/pantone-colors/${id}`, { method: 'DELETE' })

// --- Formulas ---
export const listFormulas = () => apiFetch('/formulas').then((r) => r.json())
export const createFormula = (payload) => apiFetch('/formulas', { method: 'POST', body: payload }).then((r) => r.json())
export const deleteFormula = (id) => apiFetch(`/formulas/${id}`, { method: 'DELETE' })

// --- Designs ---
export const listDesigns = () => apiFetch('/designs').then((r) => r.json())
export const createDesign = (payload) => apiFetch('/designs', { method: 'POST', body: payload }).then((r) => r.json())
export const updateDesign = (id, payload) => apiFetch(`/designs/${id}`, { method: 'PATCH', body: payload }).then((r) => r.json())
export const deleteDesign = (id) => apiFetch(`/designs/${id}`, { method: 'DELETE' })

// --- Access logs (admin) ---
export const listAccessLogs = () => apiFetch('/access-logs').then((r) => r.json())

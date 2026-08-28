// Endpoint helpers over the shared /api/v1 client (see client.js).
import { API_BASE, apiFetch } from './client.js'
import { getToken } from '../auth/store.js'

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

// --- Samples ---
// Reusable (archived) samples for a target Pantone: newest-first, capped at 5
// server-side. Query params, not a path — mirrors the backend listing contract.
export const listReusableSamples = (pantoneTargetId) =>
  apiFetch(`/samples?pantone_target_id=${encodeURIComponent(pantoneTargetId)}&status=archivada_reutilizable`).then(
    (r) => r.json(),
  )

// Create / update a sample. POST defaults the status to archivada_reutilizable
// server-side; PATCH accepts status/photo_url/notes only (pantone target is
// immutable once created). SampleOut mirrors the backend contract.
export const createSample = (payload) =>
  apiFetch('/samples', { method: 'POST', body: payload }).then((r) => r.json())
export const updateSample = (id, payload) =>
  apiFetch(`/samples/${id}`, { method: 'PATCH', body: payload }).then((r) => r.json())

// Promote a reusable sample into a NEW formula. One atomic backend call
// (POST /samples/{id}/promote): the server derives pantone_color_id from the
// sample, marks it aprobada, sets formula_id, and writes one sample.promote
// audit row. Returns { formula, sample }. 404/409 are surfaced as thrown errors
// by apiFetch on !ok.
export const promoteSample = (id, payload) =>
  apiFetch(`/samples/${id}/promote`, { method: 'POST', body: payload }).then((r) => r.json())

// Upload a sample photo as multipart/form-data. Deliberately does NOT go
// through apiFetch: a FormData body must let fetch derive the multipart
// boundary, so no JSON content-type is set here (the upload endpoint rejects
// JSON bodies). Only the Bearer token is attached.
export async function uploadSamplePhoto(file) {
  const form = new FormData()
  form.append('photo', file)
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/samples/upload`, {
    method: 'POST',
    headers,
    body: form,
  })

  if (!res.ok) {
    let detail = 'Error al subir la foto'
    try {
      const data = await res.json()
      if (data && typeof data.detail === 'string') detail = data.detail
    } catch {
      /* keep default */
    }
    throw new Error(detail)
  }
  return res.json() // { photo_url }
}

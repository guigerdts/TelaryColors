// Token store (localStorage-persisted) — ADR-3: Bearer token in
// localStorage for the LAN MVP (XSS tradeoff documented in design).
const KEY = 'telary_color_token'

/** Read the persisted access token, or null when absent/empty. */
export function getToken() {
  return localStorage.getItem(KEY)
}

/** Persist the access token so it survives a page reload. */
export function setToken(token) {
  localStorage.setItem(KEY, token)
}

/** Remove the access token (logout / 401 session expiry). */
export function clearToken() {
  localStorage.removeItem(KEY)
}

// Auth context + provider + useAuth hook.
//
// React context so pages/guard can react to login/logout and read the
// current user profile, while the raw token lives in the auth store
// (localStorage). A 401 handshake clears the token and performs a full
// navigation to /login (see api/client.js), so a page reload re-reads the
// store and React state stays coherent without cross-tab syncing.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { clearToken, getToken, setToken } from './store.js'
import { login as apiLogin, me } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken())
  const [user, setUser] = useState(null)

  // Load the profile whenever a token is present.
  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    let cancelled = false
    me()
      .then((profile) => {
        if (!cancelled) setUser(profile)
      })
      .catch(() => {
        // A 401 clears the token via the client; otherwise just clear the
        // local profile so the UI never shows a stale user.
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password)
    setToken(data.access_token)
    setTokenState(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  const value = { token, user, isAuthenticated: Boolean(token), login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

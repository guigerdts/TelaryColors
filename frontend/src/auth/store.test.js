import { beforeEach, describe, expect, it } from 'vitest'

import { clearToken, getToken, setToken } from './store.js'

const KEY = 'telary_color_token'

describe('auth token store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists the token to localStorage so it survives a reload', () => {
    setToken('jwt-abc')

    // A fresh read (as after a page reload) still sees the token.
    expect(getToken()).toBe('jwt-abc')
    // It is physically in localStorage.
    expect(localStorage.getItem(KEY)).toBe('jwt-abc')
  })

  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull()
  })

  it('clears the token on logout', () => {
    setToken('jwt-abc')
    clearToken()

    expect(getToken()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

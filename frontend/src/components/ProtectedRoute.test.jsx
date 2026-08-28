import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './ProtectedRoute.jsx'

const KEY = 'telary_color_token'

describe('ProtectedRoute guard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('redirects to /login when there is no valid token', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/login" element={<div>Login de acceso</div>} />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <div>Contenido protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    // The guard navigated to /login and never rendered the protected content.
    expect(screen.getByText('Login de acceso')).toBeTruthy()
    expect(screen.queryByText('Contenido protegido')).toBeNull()
  })

  it('renders the children when a token is present', () => {
    localStorage.setItem(KEY, 'jwt-abc')

    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/login" element={<div>Login de acceso</div>} />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <div>Contenido protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Contenido protegido')).toBeTruthy()
  })
})

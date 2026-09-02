// Login page — Spanish UI. Calls the auth login action and navigates to the
// search screen on success; shows the Spanish `detail` on failure.
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider.jsx'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const onSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Usuario o contraseña incorrectos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-surface-raised p-6 shadow-lg"
      >
        <h1 className="text-center text-xl font-bold text-text-primary">Telary Color</h1>
        <p className="-mt-2 text-center text-sm text-text-secondary">Iniciar sesión</p>

        {error && (
          <p role="alert" className="rounded bg-error-bg px-3 py-2 text-sm text-error-text">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="username" className="block text-sm font-medium text-text-primary">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded border border-border-strong px-3 py-2 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-text-primary">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-border-strong px-3 py-2 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-accent-281c py-2 text-sm font-semibold text-text-inverse transition hover:brightness-90 disabled:opacity-50 min-h-[44px]"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

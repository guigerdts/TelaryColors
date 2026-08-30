// Layout — shared app shell with top navigation (Spanish labels) and the
// authenticated user + logout action. Wraps every guarded route via <Outlet>.
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider.jsx'

const links = [
  { to: '/search', label: 'Buscar' },
  { to: '/pantone', label: 'Pantone' },
  { to: '/formulas', label: 'Fórmulas' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/inventario/alertas', label: 'Alertas' },
  { to: '/designs', label: 'Diseños' },
  { to: '/muestras', label: 'Muestras' },
  { to: '/usuarios', label: 'Usuarios' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold text-slate-800">Telary Color</span>
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-accent-281c ${
                    isActive ? 'bg-accent-281c text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{user?.full_name || user?.username}</span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

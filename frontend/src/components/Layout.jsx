// Layout — shared app shell with responsive navigation (Spanish labels) and
// the authenticated user + logout action. Wraps every guarded route via
// <Outlet>.
//
// Navigation strategy (Fase 5 fix, "/impeccable adapt"):
// - Desktop/tablet (md+): horizontal top nav with every destination visible.
// - Mobile (< md): sticky header (brand + account) + fixed bottom-nav with the
//   four highest-frequency plant destinations (Buscar, Pantone, Formulas,
//   Inventario) plus a "Mas" slot that opens a sheet with the remaining
//   destinations (Alertas, Disenos, Muestras, Usuarios [admin-only]).
// - "Salir" is an account action, not a destination: it lives in the header
//   profile menu, never in the bottom-nav.
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider.jsx'

const primaryLinks = [
  { to: '/dashboard', label: 'Inicio', icon: 'dashboard' },
  { to: '/search', label: 'Buscar', icon: 'search' },
  { to: '/pantone', label: 'Pantone', icon: 'pantone' },
  { to: '/formulas', label: 'Fórmulas', icon: 'formulas' },
  { to: '/inventario', label: 'Inventario', icon: 'inventory' },
]

// Secondary destinations live in the mobile "Más" sheet (and in the desktop
// top nav). "Usuarios" is admin-only — filtered by the current user's role.
const secondaryLinks = [
  { to: '/inventario/alertas', label: 'Alertas', icon: 'alerts' },
  { to: '/designs', label: 'Diseños', icon: 'designs' },
  { to: '/muestras/lista', label: 'Muestras', icon: 'samples' },
  { to: '/usuarios', label: 'Usuarios', icon: 'users', adminOnly: true },
]

const allLinks = [...primaryLinks, ...secondaryLinks]

function Icon({ name, className = '' }) {
  const paths = {
    search: <path d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" />,
    dashboard: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />,
    pantone: <path d="M12 3l7 4v10l-7 4-7-4V7l7-4zm0 0v18m7-14H5" />,
    formulas: <path d="M9 3h6v18H9zM3 8h2v16H3zM19 8h2v16h-2z" />,
    inventory: <path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10" />,
    alerts: <path d="M12 3a7 7 0 0 1 7 7c0 5 2 6 2 6H3s2-1 2-6a7 7 0 0 1 7-7zM10 20a2 2 0 0 0 4 0" />,
    designs: <path d="M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14M4 20h16M8 8h8M8 12h5" />,
    samples: <path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h4" />,
    users: <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    more: (
      <>
        <circle cx="12" cy="5" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="12" cy="19" r="1.6" />
      </>
    ),
    user: <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM4 21a8 8 0 0 1 16 0" />,
    chevron: <path d="M6 9l6 6 6-6" />,
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return undefined
    const handleClick = (e) => {
      if (!e.target.closest('[aria-haspopup="menu"]') && !e.target.closest('[role="menu"]')) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileOpen])

  const onLogout = () => {
    logout()
    navigate('/login')
  }

  // M1: Ctrl/Cmd+K jumps straight to the search page — the highest-frequency
  // operator action. It prevents the browser's native Ctrl+K search UI and is
  // only attached away from /search so it never hijacks the page it targets.
  // Re-attached on every navigation; removed on unmount.
  useEffect(() => {
    if (location.pathname === '/search') return undefined
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        navigate('/search')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [location.pathname, navigate])

  // Destinations available to the current user (drops admin-only ones for
  // operators).
  const visibleLinks = allLinks.filter((l) => !l.adminOnly || user?.role === 'admin')
  const visibleSecondary = secondaryLinks.filter(
    (l) => !l.adminOnly || user?.role === 'admin',
  )

  const accountClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 rounded px-2 pb-2 pt-1.5 text-[10px] font-medium leading-none transition focus-visible:ring-2 focus-visible:ring-primary-500/30 active:bg-slate-100 ${
      isActive ? 'text-primary-500 bg-primary-50' : 'text-slate-600'
    }`

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header — always sticky; adaptive height via safe-area on mobile. */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <NavLink
            to="/search"
            className="flex items-center gap-2 font-bold text-slate-800 focus-visible:ring-2 focus-visible:ring-primary-500/30"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary-500">
              <span className="text-xs font-black leading-none text-white">T</span>
            </span>
            <span className="text-xl leading-none">Telary Color</span>
          </NavLink>

          {/* Desktop / tablet top nav (md+). */}
          <nav className="hidden items-center gap-1.5 md:flex">
            {visibleLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
                    isActive ? 'text-primary-500 bg-primary-50' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Account — profile menu with admin access + logout. */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500/30"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <Icon name="user" className="h-5 w-5 text-slate-500" />
              <span className="max-w-[120px] truncate text-slate-600">
                {user?.full_name || user?.username}
              </span>
              <Icon name="chevron" className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg animate-panel-in"
              >
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">Cuenta</p>
                  <p className="text-sm font-medium text-slate-700">
                    {user?.full_name || user?.username}
                  </p>
                  <p className="text-xs capitalize text-slate-600">{user?.role}</p>
                </div>
                {user?.role === 'admin' && (
                  <NavLink
                    to="/usuarios"
                    onClick={() => setProfileOpen(false)}
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Usuarios / Administración
                  </NavLink>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  Salir
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content — extra bottom padding so the fixed mobile nav never
          covers the last rows of a page. */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom-nav (md-). Fixed four primary destinations + "Más". */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around">
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex min-h-[56px] min-w-0 flex-1 items-center justify-center` +
                ' ' +
                accountClass({ isActive })
              }
            >
              <span className="flex flex-col items-center gap-0.5">
                <Icon name={link.icon} className="h-5 w-5" />
                <span>{link.label}</span>
              </span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="flex min-h-[56px] min-w-0 flex-1 items-center justify-center rounded px-2 pb-2 pt-1.5 text-[10px] font-medium leading-none text-slate-600 transition active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-500/30"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <span className="flex flex-col items-center gap-0.5">
              <Icon name="more" className="h-5 w-5" />
              <span>Más</span>
            </span>
          </button>
        </div>

        {/* "Más" sheet — secondary destinations above the nav bar. */}
        {moreOpen && (
          <>
            <button
              type="button"
              aria-label="Cerrar"
              className="fixed inset-0 z-[-1] cursor-default"
              onClick={() => setMoreOpen(false)}
            />
            <div className="border-t border-slate-200 bg-white animate-panel-in">
              <p className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Más opciones
              </p>
              {visibleSecondary.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-4 text-sm font-medium text-slate-700 transition active:bg-slate-100 ${
                      isActive ? 'text-primary-500' : ''
                    }`
                  }
                >
                  <Icon name={link.icon} className="h-5 w-5 text-slate-400" />
                  {link.label}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </nav>
    </div>
  )
}

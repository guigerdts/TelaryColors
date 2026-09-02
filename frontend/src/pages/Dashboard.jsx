// Dashboard — operational home station for Telary Color.
// "El Laboratorio de Precisión": the user enters and immediately sees
// what's happening, what they can do now, and what needs attention.
//
// Data sources (all real, no fabricated metrics):
// - listFormulas, listDesigns, listPantone, listSamples → counts + recent
// - listInventoryItems → bajo_umbral alerts
// - listReorderAlerts → items needing reorder
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  listDesigns,
  listFormulas,
  listInventoryItems,
  listPantone,
  listSamples,
} from '../api/index.js'
import StatusBadge from '../components/StatusBadge.jsx'

// --- Skeleton loaders -------------------------------------------------------

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando dashboard">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="h-4 w-32" />
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonBlock className="h-48 rounded-lg lg:col-span-2" />
        <SkeletonBlock className="h-48 rounded-lg" />
      </div>
    </div>
  )
}

// --- Quick action card ------------------------------------------------------

function QuickAction({ to, label, description, icon }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500 transition group-hover:bg-primary-100">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800 group-hover:text-primary-600">
          {label}
        </span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </Link>
  )
}

// --- Summary stat ------------------------------------------------------------

function Stat({ label, value, href, color }) {
  const content = (
    <span className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <span className="block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className={`mt-1 block text-2xl font-bold tabular-nums ${
          color || 'text-slate-800'
        }`}
      >
        {value}
      </span>
    </span>
  )

  return href ? (
    <Link
      to={href}
      className="focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none"
    >
      {content}
    </Link>
  ) : (
    content
  )
}

// --- Section ----------------------------------------------------------------

function Section({ title, children, action }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// --- Main Dashboard ---------------------------------------------------------

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [formulas, setFormulas] = useState([])
  const [designs, setDesigns] = useState([])
  const [pantones, setPantones] = useState([])
  const [samples, setSamples] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [f, d, p, s, inv] = await Promise.all([
          listFormulas(),
          listDesigns(),
          listPantone(),
          listSamples(),
          listInventoryItems(),
        ])
        if (cancelled) return
        setFormulas(f)
        setDesigns(d)
        setPantones(p)
        setSamples(s)
        setInventoryItems(inv)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p className="font-semibold">Error al cargar el dashboard</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const bajoUmbral = inventoryItems.filter(
    (item) => item.inventory_status === 'bajo_umbral',
  )

  // Recent items (last 5, newest first — API already returns newest-first)
  const recentFormulas = formulas.slice(0, 5)
  const recentDesigns = designs.slice(0, 5)

  return (
    <div className="space-y-6">
      {/* --- Header --- */}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <time
          dateTime={new Date().toISOString().slice(0, 10)}
          className="text-xs text-slate-500"
        >
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      </div>

      {/* --- Quick Actions --- */}
      <Section title="Acciones rápidas">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction
            to="/search"
            label="Buscar color"
            description="Código PMS, nombre o hex"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            }
          />
          <QuickAction
            to="/formulas"
            label="Fórmulas"
            description={`${formulas.length} fórmulas activas`}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M9 3h6v18H9zM3 8h2v16H3zM19 8h2v16h-2z" />
              </svg>
            }
          />
          <QuickAction
            to="/designs"
            label="Diseños"
            description={`${designs.length} diseños registrados`}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14M4 20h16M8 8h8M8 12h5" />
              </svg>
            }
          />
          <QuickAction
            to="/inventario"
            label="Inventario"
            description={`${bajoUmbral.length} bajo umbral`}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10" />
              </svg>
            }
          />
        </div>
      </Section>

      {/* --- Inventory Alerts (if any) --- */}
      {bajoUmbral.length > 0 && (
        <Section
          title="Inventario — atención requerida"
          action={
            <Link
              to="/inventario/alertas"
              className="text-xs font-medium text-primary-500 hover:text-primary-600"
            >
              Ver todas →
            </Link>
          }
        >
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <ul className="divide-y divide-amber-200">
              {bajoUmbral.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium text-slate-800">{item.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-slate-600">
                      {item.current_stock} {item.unit}
                    </span>
                    <StatusBadge status={item.inventory_status} />
                  </span>
                </li>
              ))}
            </ul>
            {bajoUmbral.length > 5 && (
              <p className="mt-2 text-xs text-amber-700">
                +{bajoUmbral.length - 5} items más bajo umbral
              </p>
            )}
          </div>
        </Section>
      )}

      {/* --- Summary + Recent --- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Summary stats */}
        <Section title="Resumen">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Pantone" value={pantones.length} href="/pantone" />
            <Stat label="Fórmulas" value={formulas.length} href="/formulas" />
            <Stat label="Diseños" value={designs.length} href="/designs" />
            <Stat label="Muestras" value={samples.length} href="/muestras/lista" />
          </div>
        </Section>

        {/* Recent formulas */}
        <Section title="Fórmulas recientes">
          {recentFormulas.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              Sin fórmulas creadas
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {recentFormulas.map((f) => (
                <li key={f.id} className="px-4 py-3">
                  <Link
                    to={`/pantone/${f.pantone_color_id}`}
                    className="block text-sm font-medium text-slate-800 hover:text-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none"
                  >
                    {f.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {f.ingredients?.length ?? 0} ingredientes
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Recent designs */}
        <Section title="Diseños recientes">
          {recentDesigns.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
              Sin diseños creados
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {recentDesigns.map((d) => (
                <li key={d.id} className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-800">{d.name}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {d.colors?.length ?? 0} colores
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs capitalize text-slate-500">{d.paint_type}</span>
                  </div>
                  {/* Color dots */}
                  {d.colors?.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {d.colors.slice(0, 7).map((dc, i) => (
                        <span
                          key={i}
                          className="inline-block h-3 w-3 rounded-full border border-slate-200"
                          style={{ backgroundColor: dc.hex_color || '#94a3b8' }}
                          title={dc.pantone_code || `Color ${dc.pantone_color_id}`}
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* --- Search shortcut hint --- */}
      <p className="text-center text-xs text-slate-400">
        Atajo de búsqueda: <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Ctrl</kbd> + <kbd className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">K</kbd>
      </p>
    </div>
  )
}

// InventoryAlerts page — Spanish UI. Renders the backend's reorder-alert
// groups VERBATIM: GET /inventory/reorder-alerts already groups by
// supply_city + supplier (SQL GROUP BY in slice D) and every item carries its
// served inventory_status (InventoryItemOut / derive_status — design ADR-1/4).
// This page ONLY maps over the served groups → group.items; it never regroups,
// re-sorts, or re-keys the data in the browser, and never recomputes
// ok/bajo_umbral from current_stock vs reorder_threshold.
import { useEffect, useState } from 'react'

import { listReorderAlerts } from '../api/index.js'

// Display-only mapping from the served enum value to its badge tone. This is
// NOT a stock computation — the value itself always comes from the API.
const statusTone = {
  ok: 'bg-green-100 text-green-700',
  bajo_umbral: 'bg-amber-100 text-amber-700',
}

export default function InventoryAlertsPage() {
  const [groups, setGroups] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    listReorderAlerts().then(setGroups).catch((err) => setError(err.message))
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Alertas de reposición</h2>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">Sin alertas de reposición</p>
      ) : (
        <div className="space-y-6">
          {/* Backend group order is authoritative — rendered as-is, no re-sort. */}
          {groups.map((group, idx) => (
            <section
              key={`${group.supply_city}-${group.supplier}`}
              aria-labelledby={`alert-group-${idx}`}
              className="overflow-hidden rounded border border-slate-200 bg-white"
            >
              {/* Header band distinct from the flat item rows below — the group
                  reads as a section, not as a card wrapping nested cards. */}
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3
                  id={`alert-group-${idx}`}
                  className="font-semibold text-slate-800"
                >
                  {group.supply_city}
                </h3>
                <h4 className="text-sm font-medium text-slate-500">{group.supplier}</h4>
              </div>
              <ul className="divide-y divide-slate-100">
                {/* Items mapped in served order — no re-key, no regroup. */}
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{item.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {item.item_type} · Stock: {item.current_stock} {item.unit} · Umbral:{' '}
                        {item.reorder_threshold} {item.unit}
                      </p>
                    </div>
                    {/* Served status verbatim — never recomputed client-side (ADR-1/4). */}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusTone[item.inventory_status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.inventory_status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
// Inventory page — Spanish UI. Lists inventory items with the binary stock
// status computed BY THE BACKEND (inventory_status from InventoryItemOut /
// derive_status — design ADR-1/4): the badge text comes straight from the
// served payload, so this page NEVER recomputes ok/bajo_umbral from
// current_stock vs reorder_threshold. The form creates or edits an item's six
// tracked fields (name, item_type, unit, supplier, supply_city,
// reorder_threshold); current_stock is intentionally absent — stock only
// moves through transactions (design ADR-6).
import { useEffect, useState } from 'react'

import { createInventoryItem, listInventoryItems, updateInventoryItem } from '../api/index.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

const emptyItem = {
  name: '',
  item_type: 'colorante',
  unit: '',
  supplier: '',
  supply_city: '',
  reorder_threshold: '',
}

export default function InventoryPage() {
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyItem)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  // true once create/edit is staged but not yet confirmed.
  const [pendingSubmit, setPendingSubmit] = useState(false)

  const refresh = () => {
    listInventoryItems().then(setItems).catch((err) => setError(err.message))
  }

  useEffect(() => {
    refresh()
  }, [])

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const startEdit = (item) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      item_type: item.item_type,
      unit: item.unit,
      supplier: item.supplier,
      supply_city: item.supply_city,
      reorder_threshold: Number(item.reorder_threshold),
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyItem)
  }

  // Form submit stages the confirmation dialog; the real API call runs only
  // after the operator confirms.
  const onSubmit = (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setPendingSubmit(true)
  }

  // Runs after the operator confirms in the dialog — executes the real
  // create/update request (both modes share this flow).
  const confirmSave = async () => {
    setMessage(null)
    setError(null)
    try {
      const payload = {
        name: form.name,
        item_type: form.item_type,
        unit: form.unit,
        supplier: form.supplier,
        supply_city: form.supply_city,
        // The API receives a number; the backend enforces ge=0 (schemas.py).
        reorder_threshold: Number(form.reorder_threshold),
      }
      if (editingId === null) {
        await createInventoryItem(payload)
        setMessage('Item creado')
      } else {
        await updateInventoryItem(editingId, payload)
        setMessage('Item actualizado')
      }
      resetForm()
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingSubmit(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Inventario</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form id="inventory-form" onSubmit={onSubmit} className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-700">
          {editingId === null ? 'Nuevo item' : 'Editar item'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Nombre</span>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Tipo</span>
            <select
              value={form.item_type}
              onChange={(e) => setField('item_type', e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            >
              <option value="colorante">Colorante</option>
              <option value="insumo_pasta_madre">Insumo pasta madre</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Unidad</span>
            <input
              value={form.unit}
              onChange={(e) => setField('unit', e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Proveedor</span>
            <input
              value={form.supplier}
              onChange={(e) => setField('supplier', e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Ciudad de provisión</span>
            <input
              value={form.supply_city}
              onChange={(e) => setField('supply_city', e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">Umbral de reposición</span>
            <input
              type="number"
              step="any"
              min="0"
              value={form.reorder_threshold}
              onChange={(e) => setField('reorder_threshold', e.target.value)}
              title="Cuando el stock baje de este valor, el estado cambiará a bajo umbral"
              required
              className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90 min-h-[44px]"
          >
            {editingId === null ? 'Crear item' : 'Guardar cambios'}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-center">
          <h3 className="text-sm font-semibold text-slate-700">Sin items de inventario</h3>
          <p className="mt-1 text-sm text-slate-600">
            Agrega tu primer item de inventario para comenzar a rastrear stock.
          </p>
          <button
            type="button"
            onClick={() => { document.getElementById('inventory-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }}
            className="mt-3 rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90"
          >
            Crear item de inventario
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => startEdit(item)}
                aria-label={`Ver/editar ${item.name} — ${
                  item.inventory_status === 'bajo_umbral' ? 'bajo nivel de stock' : 'stock ok'
                }`}
                className="block w-full p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  {/* Served status verbatim — never recomputed client-side (ADR-1/4). */}
                  <StatusBadge status={item.inventory_status} />
                </div>
                <p className="text-xs text-slate-600">
                  {item.item_type} · {item.supplier} · {item.supply_city}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <span>
                    Stock: <span className="font-medium tabular-nums">{item.current_stock}</span>{' '}
                    {item.unit}
                  </span>
                  <span>
                    Umbral: <span className="font-medium tabular-nums">{item.reorder_threshold}</span>{' '}
                    {item.unit}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingSubmit}
        title={editingId !== null ? 'Actualizar item de inventario' : 'Crear item de inventario'}
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        onConfirm={confirmSave}
        onClose={() => setPendingSubmit(false)}
      >
        <p className="mt-3 text-sm text-slate-600">
          ¿Estás seguro de que quieres {editingId !== null ? 'guardar los cambios de' : 'crear'} este item de inventario?
        </p>
      </ConfirmDialog>
    </div>
  )
}
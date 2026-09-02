// Admin Users page — Spanish UI. Admin-only user listing + role changes.
import { useEffect, useMemo, useState } from 'react'

import { listUsers, updateUser, createUser, listAccessLogs } from '../api/index.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

// Spanish labels for role values shown to the operator.
const ROLE_LABELS = { operator: 'operador', admin: 'admin' }

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('operator')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  // A role change awaiting confirmation: { id, username, nextRole } | null.
  const [pendingRole, setPendingRole] = useState(null)
  const [roleBusy, setRoleBusy] = useState(false)
  // true once the new-user form is staged but not yet confirmed.
  const [pendingSubmit, setPendingSubmit] = useState(false)
  // Number of audit log entries currently shown; grows by PAGE_SIZE per "load more".
  const [logVisibleCount, setLogVisibleCount] = useState(10)

  const refreshUsers = () => {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
    listAccessLogs()
      .then(setLogs)
      .catch(() => {})
  }

  useEffect(() => {
    refreshUsers()
  }, [])

  // Groups the visible log entries by calendar day, preserving log order.
  // Each group carries a Spanish date header like "1 de septiembre de 2026".
  const groupedLogs = useMemo(() => {
    const groups = new Map()
    for (const log of logs.slice(0, logVisibleCount)) {
      const date = new Date(log.timestamp)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          entries: [],
        })
      }
      groups.get(key).entries.push(log)
    }
    return [...groups.values()]
  }, [logs, logVisibleCount])

  // Form submit stages the confirmation dialog; the real API call runs only
  // after the operator confirms.
  const onCreate = (event) => {
    event.preventDefault()
    setMessage(null)
    setError(null)
    setPendingSubmit(true)
  }

  // Runs after the operator confirms in the dialog — executes the create.
  const confirmCreate = async () => {
    setMessage(null)
    setError(null)
    try {
      await createUser({ username, full_name: fullName || null, password, role })
      setMessage('Usuario creado')
      setUsername('')
      setFullName('')
      setPassword('')
      setRole('operator')
      refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingSubmit(false)
    }
  }

  // Stages a role change for confirmation instead of applying it immediately.
  const onRoleChange = (id, nextRole) => {
    setError(null)
    const user = users.find((u) => u.id === id)
    if (!user) return
    if (user.role === nextRole) return
    setPendingRole({ id, username: user.username, nextRole })
  }

  // Runs AFTER the operator confirms the role change in the dialog.
  const handleRoleConfirm = async () => {
    if (!pendingRole) return
    setRoleBusy(true)
    try {
      await updateUser(pendingRole.id, { role: pendingRole.nextRole })
      setMessage('Rol actualizado')
      refreshUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setRoleBusy(false)
      setPendingRole(null)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-text-primary">Usuarios (administración)</h2>

      {message && (
        <p className="rounded bg-success-bg px-3 py-2 text-sm text-success-text">{message}</p>
      )}
      {error && <p className="rounded bg-error-bg px-3 py-2 text-sm text-error-text">{error}</p>}

      <form onSubmit={onCreate} className="space-y-3 rounded border border-border-default bg-surface-raised p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-text-secondary">Usuario *</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-text-secondary">Nombre completo</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-text-secondary">Contraseña *</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-text-secondary">Rol *</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded border border-border-strong px-3 py-2.5 text-sm focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="operator">operador</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </div>

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            className="rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-text-inverse hover:brightness-90 min-h-[44px]"
          >
            Crear
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-text-muted">
            <th className="py-2">Usuario</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Último acceso</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border-default text-text-primary">
              <td className="py-2 font-medium">{user.username}</td>
              <td>{user.full_name ?? '—'}</td>
              <td>
                <select
                  aria-label={`Rol de ${user.username}`}
                  value={user.role}
                  onChange={(e) => onRoleChange(user.id, e.target.value)}
                  className="rounded border border-border-strong px-2 py-1 text-xs"
                >
                  <option value="operator">operador</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>{user.last_access_at ? new Date(user.last_access_at).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      <section>
        <h3 className="mb-2 font-semibold text-text-primary">Registro de auditoría</h3>
        <div className="flex flex-col">
          {groupedLogs.map((group) => (
            <div key={group.key}>
              <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {group.label}
              </h4>
              <ul className="divide-y divide-border-default text-sm text-text-secondary">
                {group.entries.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span>{log.action}</span>
                    <span className="text-xs text-text-secondary">{new Date(log.timestamp).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {logVisibleCount < logs.length && (
          <button
            type="button"
            onClick={() => setLogVisibleCount((n) => n + 10)}
            className="mt-4 rounded border border-border-strong px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken"
          >
            Cargar más
          </button>
        )}
      </section>

      <ConfirmDialog
        open={!!pendingRole}
        title="Cambiar rol de usuario"
        description={
          pendingRole
            ? `Se cambiará el rol de "${pendingRole.username}" a "${ROLE_LABELS[pendingRole.nextRole] ?? pendingRole.nextRole}".`
            : undefined
        }
        danger
        busy={roleBusy}
        onClose={() => setPendingRole(null)}
        onConfirm={handleRoleConfirm}
      />

      <ConfirmDialog
        open={pendingSubmit}
        title="Crear usuario"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        onConfirm={confirmCreate}
        onClose={() => setPendingSubmit(false)}
      >
        <p className="mt-3 text-sm text-text-secondary">
          ¿Estás seguro de que quieres crear este usuario?
        </p>
      </ConfirmDialog>
    </div>
  )
}

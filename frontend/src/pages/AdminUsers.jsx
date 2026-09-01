// Admin Users page — Spanish UI. Admin-only user listing + role changes.
import { useEffect, useState } from 'react'

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

  const onCreate = async (event) => {
    event.preventDefault()
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
      <h2 className="text-xl font-bold text-slate-800">Usuarios (administración)</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Usuario</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Nombre completo</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-600">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          >
            <option value="operator">operador</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-accent-281c px-4 py-1.5 text-sm font-semibold text-white hover:brightness-90"
        >
          Crear
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-slate-400">
            <th className="py-2">Usuario</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Último acceso</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-slate-100 text-slate-700">
              <td className="py-2 font-medium">{user.username}</td>
              <td>{user.full_name ?? '—'}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => onRoleChange(user.id, e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
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

      <section>
        <h3 className="mb-2 font-semibold text-slate-700">Registro de auditoría</h3>
        <ul className="divide-y divide-slate-100 text-sm text-slate-600">
          {logs.slice(0, 25).map((log) => (
            <li key={log.id} className="flex justify-between py-1">
              <span>{log.action}</span>
              <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
            </li>
          ))}
        </ul>
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
    </div>
  )
}

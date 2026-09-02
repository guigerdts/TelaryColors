// SampleRegistration — Spanish UI. Mobile-first registration of a reusable
// color sample in at most a few taps: pick a Pantone target, optionally snap
// a rear-camera photo, choose a status and save. The photo is OPTIONAL (spec
// "Optional Photo"): a sample can be created without one and the photo added
// later via PATCH.
import { useEffect, useState } from 'react'

import { createSample, listPantone, uploadSamplePhoto } from '../api/index.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function SampleRegistrationPage() {
  const [colors, setColors] = useState([])
  const [pantoneTargetId, setPantoneTargetId] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [status, setStatus] = useState('archivada_reutilizable')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  // true once the operator submits the form but hasn't confirmed yet.
  const [pendingSubmit, setPendingSubmit] = useState(false)

  useEffect(() => {
    let cancelled = false
    listPantone()
      .then((data) => {
        if (!cancelled) setColors(data)
      })
      .catch(() => {
        /* the target list is loaded best-effort on mount */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Form submit stages the confirmation dialog; the real API call runs only
  // after the operator confirms.
  const onSave = (event) => {
    event.preventDefault()
    if (!pantoneTargetId) return
    setPendingSubmit(true)
  }

  // Runs after the operator confirms in the dialog — executes the actual save.
  const confirmSave = async () => {
    setMessage(null)
    setError(null)
    setSaving(true)
    try {
      // Photo optional: only upload when the user actually picked a file.
      let photoUrl = null
      if (photoFile) {
        const uploaded = await uploadSamplePhoto(photoFile)
        photoUrl = uploaded.photo_url
      }
      await createSample({
        pantone_target_id: Number(pantoneTargetId),
        photo_url: photoUrl,
        status,
        notes: notes.trim() ? notes.trim() : null,
      })
      setMessage('Muestra registrada')
      setPantoneTargetId('')
      setPhotoFile(null)
      setNotes('')
      setStatus('archivada_reutilizable')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
      setPendingSubmit(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Registrar muestra</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={onSave} className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Color Pantone</span>
          <select
            value={pantoneTargetId}
            onChange={(e) => setPantoneTargetId(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          >
            <option value="">Seleccionar…</option>
            {colors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Foto (opcional)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            /* Rear-camera hint: the mobile browser opens the back camera. */
            capture="environment"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-accent-281c/10 file:px-3 file:py-2.5 file:text-sm file:font-medium file:text-accent-281c hover:file:bg-accent-281c/15"
          />
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Estado</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          >
            <option value="archivada_reutilizable">Archivada reutilizable</option>
            <option value="aprobada">Aprobada</option>
            <option value="descartada">Descartada</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2.5 text-sm focus:border-accent-281c focus:outline-none focus:ring-2 focus:ring-accent-281c/30"
          />
        </label>

        <button
          type="submit"
          disabled={!pantoneTargetId || saving}
          className="w-full rounded bg-accent-281c px-4 py-2 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Registrar muestra'}
        </button>
      </form>

      <ConfirmDialog
        open={pendingSubmit}
        title="Registrar muestra"
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        busy={saving}
        onConfirm={confirmSave}
        onClose={() => setPendingSubmit(false)}
      >
        <p className="mt-3 text-sm text-slate-600">
          ¿Estás seguro de que quieres guardar esta muestra?
        </p>
      </ConfirmDialog>
    </div>
  )
}

// SampleRegistration — Spanish UI. Mobile-first registration of a reusable
// color sample in at most a few taps: pick a Pantone target, optionally snap
// a rear-camera photo, choose a status and save. The photo is OPTIONAL (spec
// "Optional Photo"): a sample can be created without one and the photo added
// later via PATCH.
import { useEffect, useState } from 'react'

import { createSample, listPantone, uploadSamplePhoto } from '../api/index.js'

export default function SampleRegistrationPage() {
  const [colors, setColors] = useState([])
  const [pantoneTargetId, setPantoneTargetId] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [status, setStatus] = useState('archivada_reutilizable')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

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

  const onSave = async (event) => {
    event.preventDefault()
    if (!pantoneTargetId) return
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
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Registrar muestra</h2>

      {message && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={onSave} className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Color Pantone</span>
          <select
            value={pantoneTargetId}
            onChange={(e) => setPantoneTargetId(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
            className="w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-600 hover:file:bg-indigo-100"
          />
        </label>

        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600">Estado</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={!pantoneTargetId || saving}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Registrar muestra'}
        </button>
      </form>
    </div>
  )
}

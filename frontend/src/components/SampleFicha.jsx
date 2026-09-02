// SampleFicha — reformatted ficha of a single reusable sample (slice F).
// Renders the sample's photo thumbnail (or a "Sin foto" placeholder) plus a
// "Promover" action that promotes the sample into a new formula via the
// atomic promoteSample API call. The sample's pantone_color_id is derived
// server-side from its pantone_target_id, so the payload carries only the
// formula name/notes/ingredients. Ingredients come from the parent (a future
// promote form); no ingredient editor exists in this slice.
//
// Promoting is a destructive-ish action: it runs only after the operator
// confirms in an ARIA ConfirmDialog, shows a busy state while in flight, and
// surfaces success/error feedback inline (the promote call is caught — it
// never rejects unhandled).
import { useState } from 'react'

import { promoteSample } from '../api/index.js'
import ConfirmDialog from './ConfirmDialog.jsx'

export default function SampleFicha({ sample, colorCode, ingredients = [] }) {
  // 'idle' | 'confirm' | 'promoting' | 'success' | 'error'
  const [phase, setPhase] = useState('idle')
  const [notice, setNotice] = useState(null)

  function openConfirm() {
    setPhase('confirm')
    setNotice(null)
  }

  async function handlePromoteConfirm() {
    setPhase('promoting')
    try {
      await promoteSample(sample.id, {
        name: `Muestra ${sample.id}`,
        notes: 'Promovida desde ficha',
        ingredients,
      })
      setPhase('success')
      setNotice({ type: 'success', text: 'Muestra promovida a fórmula' })
    } catch (err) {
      // Surface the failure rather than swallowing it (the missing .catch).
      setPhase('error')
      setNotice({ type: 'error', text: err.message || 'No se pudo promover la muestra' })
    }
  }

  return (
    <div className="sample-ficha mt-2 flex items-center gap-2">
      {sample.photo_url ? (
        <img
          src={sample.photo_url}
          alt={`Muestra reutilizable de ${colorCode}`}
          className="h-12 w-12 rounded border border-border-default object-cover"
        />
      ) : (
        <span className="text-xs text-text-secondary">Sin foto</span>
      )}
      <button
        type="button"
        onClick={openConfirm}
        disabled={phase === 'promoting'}
        className="rounded bg-accent-281c px-2 py-1 text-xs font-semibold text-text-inverse hover:brightness-90 disabled:opacity-50 min-h-[44px]"
      >
        Promover
      </button>
      {notice && (
        <span
          role="status"
          className={`text-xs ${
            notice.type === 'success' ? 'text-success-text' : 'text-error-text'
          }`}
        >
          {notice.text}
        </span>
      )}

      <ConfirmDialog
        open={phase === 'confirm' || phase === 'promoting'}
        title="Promover muestra"
        description={`La muestra se convertirá en una nueva fórmula (Muestra ${sample.id}).`}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        busy={phase === 'promoting'}
        onConfirm={handlePromoteConfirm}
        onClose={() => setPhase('idle')}
      />
    </div>
  )
}

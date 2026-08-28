// SampleFicha — reformatted ficha of a single reusable sample (slice F).
// Renders the sample's photo thumbnail (or a "Sin foto" placeholder) plus a
// "Promover" action that promotes the sample into a new formula via the
// atomic promoteSample API call. The sample's pantone_color_id is derived
// server-side from its pantone_target_id, so the payload carries only the
// formula name/notes/ingredients. Ingredients come from the parent (a future
// promote form); no ingredient editor exists in this slice.
import { promoteSample } from '../api/index.js'

export default function SampleFicha({ sample, colorCode, ingredients = [] }) {
  async function handlePromote() {
    await promoteSample(sample.id, {
      name: `Muestra ${sample.id}`,
      notes: 'Promovida desde ficha',
      ingredients,
    })
  }

  return (
    <div className="sample-ficha mt-2 flex items-center gap-2">
      {sample.photo_url ? (
        <img
          src={sample.photo_url}
          alt={`Muestra reutilizable de ${colorCode}`}
          className="h-12 w-12 rounded border border-slate-200 object-cover"
        />
      ) : (
        <span className="text-xs text-slate-400">Sin foto</span>
      )}
      <button
        type="button"
        onClick={handlePromote}
        className="rounded border border-indigo-500 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
      >
        Promover
      </button>
    </div>
  )
}

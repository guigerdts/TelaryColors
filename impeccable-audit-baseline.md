# Impeccable Audit Baseline — Telary Color (Fase 4, Slice A)

Fecha: 2026-08-30 · Rama: `feat/pr-a-impeccable-audit` (base `origin/main` @ `f40b807`)
Objetivo: registro del estado visual/UX de las 6 pantallas existentes (Fases 1–3) antes de cualquier retrofit. Es el insumo de los Slices B (retrofit visual + acento 281C) y F (critique final). No se corrige nada aquí — solo se diagnostica.

## Método

Seguí el playbook `/impeccable audit` (web) de `reference/audit.md`: evaluación técnica por 5 dimensiones (Accesibilidad, Performance, Theming, Responsive, Implementation Integrity), cada hallazgo etiquetado P0–P3, con checklist por pantalla y estado fix / out-of-scope. En cada archivo corrí `context.mjs --target` (scoped fix sobre código existente — no requiere flujo init/new-work) y el detector mecánico `detect.mjs` (que en estos JSX basados en Tailwind con `<style>` mínimo devolvió pocos o ningún hallazgo automático; el grueso del trabajo es la revisión sistemática del playbook).

- Test runner backend: `.venv/bin/pytest -q` → `139 passed`
- Test runner frontend: `npx vitest run --pool=threads` → `54 passed` (13 files)
- Baseline RED (A.2): ambas suites en verde SIN tocar código de app → confirmado, el estándar de Fases 1–3 no se rompe.

## Pantallas auditadas

| # | Pantalla | Archivo(s) |
|---|----------|------------|
| 1 | Formulas | `frontend/src/pages/Formulas.jsx` |
| 2 | Search | `frontend/src/pages/Search.jsx` |
| 3 | Inventory | `frontend/src/pages/Inventory.jsx` |
| 4 | InventoryTransaction | `frontend/src/pages/InventoryTransaction.jsx` |
| 5 | InventoryAlerts | `frontend/src/pages/InventoryAlerts.jsx` |
| 6 | Designs | `frontend/src/pages/Designs.jsx` (+ `components/DesignColorPicker.jsx`) |

## Auditoría Health Score (conjunto)

| # | Dimensión | Score | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Accesibilidad | 2 | Inputs sin `<label>` asociado; foco solo por borde de color; iconografía ausente |
| 2 | Performance | 3 | Fichas/ingredientes válidos; carga doble en Search (listFormulas + reusableSamples); sin memo |
| 3 | Theming | 1 | `index.css` = solo `@import "tailwindcss"`; todos los colores hardcodeados (slate/indigo); sin token 281C |
| 4 | Responsive | 3 | Grids `sm:grid-cols-2` presentes; pero form de InventoryTransaction/Formulas un lado por debajo de 44px de objetivo táctil |
| 5 | Implementation Integrity | 3 | Sistema coherente (cards blancas + slate + indigo) pero genérico/intercambiable; anti-patrón "cards dentro de cards" en Search/Alertas |
| **Total** | | **12/20** | **Acceptable — se necesita trabajo significativo** |

Rating band: **Acceptable (10–13)** → "significant work needed". Coherente con la Fase 4: retrofit guiado.

> Nota determinista vs visual: los hallazgos son mayormente de la revisión sistemática (dimensiones), no del detector mecánico (que en estos archivos casi no dispara reglas). Llamo explícitamente lo verificado en código fuente.

## Hallazgos transversales (sistémicos)

Estos se repiten en varias pantallas → forman patrones del sistema, no errores puntuales:

- **[P1 · Theming] `index.css` no define tokens.** Solo `@import "tailwindcss"`. Cada pantalla usa clases inline (`bg-indigo-600`, `text-slate-800`, `border-slate-200`, `focus:border-indigo-500`). No hay token de marca 281C ni sistema semántico → cualquier rebranding es puntual por archivo.
- **[P1 · Theming] Acento "indigo-600" como proxy de marca.** El acento interactivo en las 6 pantallas es `indigo-600` (Tailwind default), no un color de marca. El Retrofit debe reemplazarlo por el token acento 281C (D5, spec base "Accent not dominant").
- **[P2 · A11y] Inputs con `<span>` visual en vez de `<label>` asociado.** Todas las pantallas usan `<label className="space-y-1"><span>…</span><input/></label>`. Funcional en la mayoría (el input está anidado), pero sin `htmlFor`/`id` → screen readers dependen de la asociación implícita; frágil. El campo `aria-label` sí aparece en Search (bueno).
- **[P2 · A11y/Responsive] Objetivos táctiles pequeños.** `py-1.5` (≈35px) en inputs/selects de Formulas/Designs/Inventory vs `py-2` (≈39px) en Transaction/Alertas. `< 44px` recomendado para táctil.
- **[P2 · Implementation Integrity] "Cards dentro de cards"** en Search (cada resultado es una card que contiene sub-recortes de fórmulas/muestras con `border-t border-dashed`) y en InventoryAlerts (cards de grupo con ítems anidados). Anti-patrón que Impeccable señala.
- **[P1 · Theming] Foco solo por color de borde** (`focus:border-indigo-500`). Sin anillo/outline offset → el indicador de foco es débil para navegación por teclado.
- **[P3 · Performance] Búsqueda sin memoización** en listas de Search/Formula (map por resultado). A escala pequeña no importa; documentar.

## Checklist por pantalla (severidad · fix/out-of-scope)

Leyenda severidad: **P0** bloqueante · **P1** mayor (WCAG AA / UX crítico) · **P2** menor · **P3** pulido. Estados: **fix** (a abordar en Slice B) · **out-of-scope** (documentado, no se toca — ver §Fuera de alcance).

### 1. Formulas

| ID | Sev | Categoría | Hallazgo | Estado |
|----|-----|-----------|----------|--------|
| F-01 | P1 | Theming | Botón "Crear fórmula" `bg-indigo-600` → acento 281C | fix (B) |
| F-02 | P1 | A11y | Foco solo por `focus:border-indigo-500` sin outline | fix (B) |
| F-03 | P2 | Theming | `text-slate-800` títulos y `text-slate-500/600` cuerpo sin token semántico | fix (B) |
| F-04 | P2 | Responsive | Inputs `py-1.5` < 44px táctil | fix (B) |
| F-05 | P2 | Implementation Integrity | Inputs/ficha duplican patrón "input en blanco con borde" sin campo requerido visible (`*`) | fix (B) |
| F-06 | P3 | Performance | `listFormulas` refresca en cada submit (aceptable a escala) | out-of-scope |
| F-07 | P3 | A11y | Faltan `required`/mensajes de error accesibles (aria) | fix (B) |

### 2. Search

| ID | Sev | Categoría | Hallazgo | Estado |
|----|-----|-----------|----------|--------|
| S-01 | P1 | Implementation Integrity | Card que contiene sub-cards de fórmulas y de muestras (cards-dentro-de-cards, `border-t border-dashed`) | fix (B) — a cargo del reemplazo por PantoneCard (slice F) o refactor de jerarquía (B) |
| S-02 | P1 | Theming | Acento `indigo` en toda la pantalla → 281C | fix (B) |
| S-03 | P2 | Performance | Doble carga: `listFormulas()` (una vez) + `listReusableSamples` por resultado (N llamadas) en paralelo | fix (B/opcional) / F consume endpoint detail (slice D/E) |
| S-04 | P2 | A11y | `aria-label="Buscar color"` ✓ (buen patrón, replicar); resultados sin `aria-live` para anunciar actualización | fix (B) |
| S-05 | P2 | Responsive | Input `max-w-md` ok; grid `sm:grid-cols-2` ok | ok (mantener) |
| S-06 | P3 | UX | Mensaje "N resultado(s)" sin conteo exacto accesible | out-of-scope |

### 3. Inventory

| ID | Sev | Categoría | Hallazgo | Estado |
|----|-----|-----------|----------|--------|
| I-01 | P1 | A11y | Cada item es un `<button>` de fila completo; sin `aria-label` descriptivo del estado | fix (B) |
| I-02 | P1 | Theming | Acento/botones `indigo` → 281C; badges `green/amber` ok (semánticos) | fix (B) |
| I-03 | P2 | Theming | Badge `inventory_status` muestra el enum crudo (`bajo_umbral`) — ok técnico (ADR), pero copia UX mejorable | out-of-scope (comportamiento preserva ADR) |
| I-04 | P2 | Responsive | Inputs `py-1.5` < 44px | fix (B) |
| I-05 | P2 | Implementation Integrity | Ficha item con estado apilado sin jerarquía visual clara (stock/umbral en una línea) | fix (B) |

### 4. InventoryTransaction

| ID | Sev | Categoría | Hallazgo | Estado |
|----|-----|-----------|----------|--------|
| T-01 | P1 | Theming | Botón "Registrar transacción" full-width `bg-indigo-600` → 281C | fix (B) |
| T-02 | P1 | A11y | `disabled` en input fórmula prefilled sin `aria-describedby` explicando por qué | fix (B) |
| T-03 | P2 | Responsive | Inputs `py-2` (≈39px, cerca de 44) → subir a 44px | fix (B) |
| T-04 | P2 | UX | Campo "Fórmula" es input libre con placeholder "Opcional" (acepta IDs a ciegas) → en Slice F pasa a selector de diseños/fórmulas (spec pantone-card) | fix (F) — campo `design_id` nuevo |
| T-05 | P3 | A11y | Mensajes de error `detail` crudo en `<p>` rojo sin `role="alert"` | fix (B) |

### 5. InventoryAlerts

| ID | Sev | Categoría | Hallazgo | Estado |
|----|-----|-----------|----------|--------|
| AL-01 | P1 | Implementation Integrity | Card de grupo (ciudad/proveedor) con ítems anidados = cards-dentro-de-cards | fix (B) |
| AL-02 | P1 | Theming | Acento/estado; badges `green/amber` ok | fix (B) |
| AL-03 | P2 | A11y | Título `<h3>` de grupo + `<h4>` proveedor: jerarquía ok, pero sin `aria-labelledby` en secciones | fix (B) |
| AL-04 | P2 | Responsive | Filas flex con `justify-between`; ok en mobile, verificar saturación en 390px | fix (B/verificar) |
| AL-05 | P3 | Performance | Listado simple, sin N+1 (una sola llamada) — ok | ok (mantener) |

### 6. Designs

| ID | Sev | Categoría | Hallazgo | Estado |
|----|-----|-----------|----------|--------|
| D-01 | P1 | Theming | Botón/acento `indigo` → 281C; colores de la lista genéricos | fix (B) |
| D-02 | P1 | A11y | DesignColorPicker: botones con `aria-pressed` ✓ (buen patrón) y `disabled` al llegar a 7; falta `aria-label` de conteo | fix (B) |
| D-03 | P2 | Theming | Cards de diseño: `text-slate-400` en tipo de pintura (bajo contraste sobre blanco) | fix (B) |
| D-04 | P2 | Responsive | Inputs `py-1.5` < 44px; grid `sm:grid-cols-2` ok | fix (B) |
| D-05 | P3 | Performance | `listPantone()` + `listDesigns()` en mount (2 llamadas) — ok a escala | out-of-scope |

## Detector mecánico (verificado)

`node .../scripts/detect.mjs --json <6 pantallas>` → `[]` (sin hallazgos automáticos en las 6 pantallas). Un barrido más amplio (`pages/` + `components/`) reportó 3 anti-patrones FUERA de estas 6 pantallas, que quedan documentados como out-of-scope del Slice A/B (pantallas samples/layout no son target del audit de esta fase — aunque el retrofit B podrá tocarlas si conviene): `gray-on-color` en `SampleRegistration.jsx:100` y `Layout.jsx:39`, y `broken-image` en `Search.test.jsx:127`. Esto confirma que la mayoría de hallazgos aquí son de revisión sistemática, no de reglas mecánicas.

## Positivos a mantener (no tocar)

- `DesignColorPicker`: usa `aria-pressed` y deshabilita el 8º color (ADR-6) — patrón accesible y coherente.
- Badges de estado `green/amber` en Inventory/Alerts son semánticos y accesibles.
- `Search` usa `aria-label="Buscar color"` y debounce de 250ms (performance correcta).
- Grids responsive `sm:grid-cols-2` presentes en las 5 pantallas de lista.
- El `detail` de error del backend se muestra verbatim (ADR-3) — correcto, no desviar.
- Comentarios de bloque que explican decisiones ADR en el fuente — alto valor, conservar.

## Fuera de alcance (documentado, no se corrige en Slice A/B)

- Pantallas de Samples (`SampleRegistration.jsx`, `SampleFicha.jsx`), Login, AdminUsers y Layout: no son target del audit de esta fase. Aun así, el retrofit B puede aplicarles los tokens del tema compartido por coherencia si es de bajo riesgo (specs samples "participate in retrofit").
- El anti-patrón "cards dentro de cards" de Search se resuelve de fondo con el reemplazo por `PantoneCard` en Slice F; en Slice B solo se aligera si es de bajo riesgo.
- `broken-image` en `Search.test.jsx:127` (test, no prod) — no corregir en este slice.
- Mejoras de copy/UX profundas que requieran cambio de contrato o de comportamiento (p. ej. mostrar fecha/estado verbatim del backend) → fuera; el retrofit preserva comportamiento (spec base "Retrofit preserves behavior").

## Forecast de líneas REAL (Slice B) — derivado del audit

El tasks.md marcaba el forecast de A y B como pendiente del audit real (`Decision needed before apply: Yes`, `400-line budget risk: Medium`). Este es el número real derivado de los hallazgos:

**Slice B (retrofit + acento 281C) — forecast REAL: ~280–330 líneas de diff.**

Desglose por fichero (estimación de trabajo efectivo de los hallazgos `fix (B)`):

| Fichero | Hallazgos abordados | Δ líneas (est.) |
|---------|---------------------|-----------------|
| `frontend/src/index.css` | `@theme` token acento 281C + tokens semánticos (slate→surface, indigo→accent) + base focus ring | +25–35 |
| `frontend/src/pages/Formulas.jsx` | acento 281C, foco, labels, táctil 44px | +15–25 |
| `frontend/src/pages/Search.jsx` | acento 281C, jerarquía de cards, aria-live | +15–25 |
| `frontend/src/pages/Inventory.jsx` | acento, jerarquía ficha, táctil, aria-label | +15–25 |
| `frontend/src/pages/InventoryTransaction.jsx` | acento, táctil 44px, aria-descripción, role=alert | +15–25 |
| `frontend/src/pages/InventoryAlerts.jsx` | acento, refactor cards-anidadas, aria-labelledby | +15–25 |
| `frontend/src/pages/Designs.jsx` + `DesignColorPicker.jsx` | acento, contraste tipo pintura, táctil, aria-conteo | +15–25 |
| (opcional) `SampleRegistration.jsx`, `Layout.jsx`, `SampleFicha.jsx` | aplicar tokens del tema por coherencia (specs samples) | +15–40 |
| Tests actualizados / chunked | RED (acceso token 281C en B.1), snapshots | +10–20 |

Rango: ~130–250 líneas efectivas de cambios, + overhead de tests → **≈280–330**. Dentro del presupuesto de 500 líneas/ventana; NO requiere split. El Slice A completo (este documento) pesa ~155 líneas, muy por debajo del presupuesto.

> Nota: no se comprometió un número arbitrario antes del audit (riesgo del proposal). Este es el real, derivado de los hallazgos P1/P2 con estado `fix (B)` de cada pantalla.

## Recomendación de comandos (prioridad)

1. **[P1] `/impeccable typeset`** — jerarquía tipográfica en las 5 pantallas de lista (títulos `text-slate-800`, cuerpo `slate-500/600`) para legibilidad y jerarquía.
2. **[P1] `/impeccable polish` por pantalla** (Formulas → Search → Inventory → Transaction → Alerts → Designs) guiado por este baseline: acento 281C, foco, táctil 44px.
3. **[P1] `/impeccable layout`** — resolver "cards-dentro-de-cards" en Search/Alertas.
4. **[P2] `/impeccable adapt`** — verificar táctil 44px y saturación en 390px (mobile).
5. Final: repasar `/impeccable critique` en el conjunto para el Slice F.

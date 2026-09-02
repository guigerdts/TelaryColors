# Telary Color — Fase 4: Impeccable + Tarjetas Pantone + Diseños

Continuación de Fase 1 (foundation), Fase 2 (muestras reutilizables) y Fase 3 (inventario y trazabilidad) — todas mergeadas a main. Esta fase tiene dos frentes: (1) integrar **Impeccable** como skill de diseño para elevar la calidad visual de todo el frontend existente, y (2) construir la **tarjeta Pantone enriquecida** — el componente central de la app, con fórmula, diseños de uso y efecto de elevación al hover.

## 1. Qué es Impeccable y cómo se integra

Impeccable (github.com/pbakaus/impeccable) **no es una librería de componentes** — es un skill de diseño para agentes de IA (compatible con Claude Code, Cursor, Gemini CLI, Codex, y **OpenCode** entre sus providers). Le da al agente vocabulario de diseño, anti-patrones a evitar (gradientes morados genéricos, cards-dentro-de-cards, áreas táctiles pequeñas, tipografías sobreusadas) y comandos para auditar/pulir el resultado.

**Instalación:**
```
npx impeccable install --providers=opencode
```

**Comandos relevantes para esta fase:**
- `/impeccable audit` — encuentra problemas de diseño en el estado actual (Fases 1-3).
- `/impeccable critique` — revisión completa de diseño.
- `/impeccable polish` — limpieza final de una pantalla o componente.
- `/impeccable distill` — elimina complejidad visual innecesaria.
- `/impeccable animate` — para el efecto de hover de las tarjetas.

Cada comando acepta un argumento opcional para enfocarse en un área: `/impeccable polish la tarjeta Pantone`.

## 2. Alcance

**Retrofit completo**: Impeccable se aplica a todo el frontend existente (Fases 1, 2 y 3), no solo a las pantallas nuevas de esta fase. El criterio: correr `/impeccable audit` sobre cada pantalla existente (Search/Formulas, Inventory, InventoryTransaction, InventoryAlerts) y aplicar `/impeccable polish` donde el audit señale problemas, antes o junto con la construcción de la tarjeta Pantone nueva.

## 3. Paleta base

- **Color principal**: Pantone 281C → `#00205B` (azul marino), tomado de catálogos Pantone online (fuente convergente en varios conversores de color). Nota de precisión: el HEX es una simulación de pantalla — no reemplaza el estándar físico Pantone si en algún momento se necesita máxima fidelidad.
- Este color se usa como base del tema de Impeccable (acentos, elementos de marca), no necesariamente como fondo dominante — evitar el anti-patrón de "todo azul oscuro" que Impeccable señala como error común.

## 4. Especificación visual de la tarjeta Pantone

Basada en el formato de tarjeta física Pantone de referencia:

- **Bloque superior**: color sólido a pantalla completa del ancho de la tarjeta (representación del Pantone).
- **Franja inferior** (fondo blanco): 
  - Wordmark "PANTONE®"
  - Código con su tipo: ej. `PMS 211 C` (coated), o el sufijo correspondiente si es `TPX`, `U`, u otras gamas.
  - HEX del color.
- **Contenido adicional específico de Telary Color** (no está en la tarjeta física de referencia, se agrega debajo o en un panel expandido):
  - **Fórmula**: lista de colorantes con cantidad en gramos por kilo.
  - **Diseños en que se ha usado**: lista de diseños/clientes vinculados a ese Pantone (ver sección 5).
- **Efecto hover**: elevación/flotación de la tarjeta al pasar el mouse — típicamente `transform: translateY(-Npx)` combinado con una transición de `box-shadow` (sombra que crece al elevarse). Construir con `/impeccable animate` para que quede consistente con el resto de las micro-interacciones del sistema.

## 5. Modelo de datos nuevo

**Tabla `designs`**
- `id`
- `name` → nombre del diseño o referencia del cliente
- `client` → nullable, nombre del cliente si aplica
- `notes` → texto libre
- `created_by` → FK a `users`
- `created_at`

**Tabla `formula_designs`** (relación fórmula ↔ diseño)
- `id`
- `formula_id` → FK a `formulas`
- `design_id` → FK a `designs`
- `source` → enum: `auto` | `manual`
- `created_at`

**Extensión a `inventory_transactions`** (de Fase 3)
- `design_id` → FK a `designs`, nullable — al registrar un consumo vinculado a una fórmula, se puede etiquetar opcionalmente con el diseño para el que se está usando. Si se etiqueta, se hace upsert automático en `formula_designs` con `source = auto` (evita duplicados: un mismo par formula_id/design_id no se repite).

Esto resuelve el requisito de "ambas" fuentes: la vía **automática** viene de las transacciones de consumo etiquetadas con diseño; la vía **manual** permite, desde la ficha del Pantone, agregar directamente un diseño histórico (previo a esta fase, o que no pasó por una transacción de inventario) sin necesidad de una transacción de stock.

Auditoría: reutilizar `access_logs` para `design.create` y `formula_design.create` (manual y auto), consistente con Fases 1-3.

## 6. Slices sugeridos (mismo patrón RED/GREEN de fases anteriores)

**A — Setup de Impeccable + audit baseline**
- Instalar el skill (`npx impeccable install --providers=opencode`).
- Correr `/impeccable audit` sobre las pantallas existentes (Formulas, Inventory, InventoryTransaction, InventoryAlerts) y documentar los hallazgos como checklist para los slices B y F.

**B — Retrofit visual de pantallas existentes**
- Aplicar `/impeccable polish` guiado por los hallazgos del audit sobre las pantallas de Fases 1-3.
- Introducir el color principal 281C (`#00205B`) como acento de marca en el tema compartido (no reescribir toda la paleta si el audit no lo señala como necesario).

**C — Data layer: diseños**
- Migración `0004_designs`: tablas `designs`, `formula_designs`, y columna `design_id` nullable en `inventory_transactions`.
- Modelos/schemas Pydantic.
- `test_migration.py::EXPECTED_TABLES` actualizado (checklist heredado de fases anteriores).

**D — Backend: CRUD de diseños + vinculación**
- CRUD de `designs`.
- Endpoint para vincular manualmente un diseño a una fórmula (`formula_designs`, `source=manual`).
- Al registrar una transacción de consumo con `design_id`, upsert automático en `formula_designs` (`source=auto`) en la misma operación atómica de la transacción (mismo patrón de Fase 3: todo en una sola operación, con rollback si falla).
- Endpoint de ficha de Pantone/fórmula extendido: incluir fórmula + lista de diseños vinculados (auto + manual, sin duplicados).

**E — Frontend: componente PantoneCard**
- Construir el componente siguiendo la especificación visual de la sección 4.
- Efecto hover de elevación (`/impeccable animate`).
- Consumir el endpoint extendido del Slice D (fórmula + diseños en una sola llamada).

**F — Frontend: integración + reemplazo de tarjetas actuales**
- Reemplazar las tarjetas/listados actuales de Pantone (Fase 1) por el nuevo `PantoneCard`.
- Agregar el flujo de "vincular diseño manualmente" desde la ficha.
- Agregar el campo opcional de diseño en el formulario de transacción de consumo (Fase 3, `InventoryTransaction.jsx`).
- Pasada final de `/impeccable critique` sobre el conjunto completo antes de cerrar la fase.

## 7. Criterios de aceptación

- Toda pantalla existente (Fases 1-3) fue auditada con Impeccable y los hallazgos relevantes fueron atendidos o documentados como fuera de alcance.
- La tarjeta Pantone muestra código+tipo de gama, HEX, fórmula en gramos/kilo, y diseños de uso, con efecto de elevación al hover.
- Un diseño puede quedar vinculado a una fórmula tanto automáticamente (vía transacción de consumo etiquetada) como manualmente (sin pasar por inventario).
- `formula_designs` nunca duplica el mismo par formula_id/design_id.
- Cobertura de tests backend (pytest) y frontend (vitest) en verde antes de cada merge, mismo estándar de fases anteriores.

## 8. Extensiones heredadas del roadmap original

El README original (Fase 4 — Extensiones) listaba cuatro puntos. Su estado dentro de esta fase:

1. **Soporte multi-gama Pantone (no solo C)** — parcialmente cubierto por esta fase: la tarjeta (sección 4) ya muestra el código con su tipo (C/coated, TPX, U), y el modelo de `pantone_colors` desde Fase 1 ya tiene `gama` como campo libre. Lo que falta y queda como tarea explícita de esta fase: confirmar en el Slice E/F que el selector de gama en los formularios de creación/búsqueda ofrezca las gamas ya usadas (C, TPX, U) como opciones reales, no solo texto libre sin validar.
2. **Reportes y exportación (PDF/Excel)** — fuera del alcance de esta fase. Queda como candidato firme para la Fase 5, pensado especialmente para presentar el estado del proyecto al dueño de Telary Home (fórmulas registradas, inventario, diseños por Pantone).
3. **Roles de usuario más granulares (operario, supervisor, administrador)** — fuera del alcance de esta fase. El criterio actual (todos los usuarios autenticados registran/editan, con trazabilidad completa en `access_logs`) se mantiene sin cambios. Candidato para Fase 5 si en el uso real surge necesidad de restringir por rol.
4. **Posible migración a despliegue en la nube** — sigue condicionada a que el dueño de Telary Home apruebe/compre el producto oficialmente. No forma parte de esta fase; la arquitectura (single-origin, SQLite, filesystem local) ya está pensada para migrar sin reescritura cuando corresponda (ver README original, sección 5).

## 9. Fuera de alcance de esta fase

- Reconocimiento automático de color por foto o cámara.
- Historial de cambios de precio/costo de la fórmula.
- Multi-idioma o internacionalización de la UI.

## 10. Instrucción para OpenCode

Seguir el mismo patrón de slices A→F con PRs independientes, RED antes de GREEN, merge estándar (no squash) a `main`, y el mismo límite de presupuesto de 500 líneas por ventana calibrado en Fases 2-3 (con split en sub-PRs si algún slice lo excede, en vez de pedir excepción). Para los slices A y B en particular (auditoría y retrofit visual con Impeccable), el forecast de líneas puede ser difícil de estimar de antemano ya que depende de los hallazgos del audit — reportar el forecast real después de correr `/impeccable audit` antes de comprometerse a un número.


# Telary Color — Fase 3: Inventario y Trazabilidad

Continuación de Fase 1 (foundation, auth, pantone+formulas) y Fase 2 (muestras reutilizables) — ambas mergeadas a main. Esta fase agrega el módulo de **inventario**: control de colorantes e insumos para la pasta madre, con trazabilidad de consumo por producción y alertas de reabastecimiento.

## Objetivo de la fase

Que la sección de pintura sepa en todo momento cuánto insumo le queda de cada colorante y material de pasta madre, cuánto se ha consumido por producción, y reciba una señal clara cuando es momento de comprar — considerando que los insumos se adquieren en otras ciudades del país y los tiempos de reposición no son inmediatos.

## Modelo de datos (extiende el esquema de Fases 1 y 2)

**Tabla `inventory_items`**
- `id`
- `name` → nombre del insumo (colorante o material de pasta madre)
- `item_type` → enum: `colorante` | `insumo_pasta_madre`
- `unit` → unidad de medida (kg, g, l, ml, etc.)
- `supplier` → proveedor
- `supply_city` → ciudad donde se compra
- `current_stock` → cantidad actual
- `reorder_threshold` → umbral mínimo antes de alertar
- `created_at`, `updated_at`

**Tabla `inventory_transactions`**
- `id`
- `inventory_item_id` → FK a `inventory_items`
- `transaction_type` → enum: `entrada` | `consumo` | `ajuste`
- `quantity` → cantidad (positiva en entrada/ajuste-alza, negativa o positiva según convención en consumo/ajuste-baja)
- `formula_id` → FK a `formulas`, nullable (vincula el consumo a la producción que lo originó)
- `user_id` → FK a `users`
- `notes` → texto libre, útil en `ajuste` para justificar la razón
- `created_at`

Reutiliza `access_logs` de Fase 1 para auditar creación de insumos y cualquier transacción de inventario.

## Slices sugeridos (mismo patrón RED/GREEN de Fases 1 y 2)

**A — Data layer**
- Migración `0003_inventory`: tablas `inventory_items` e `inventory_transactions` + enums + índices sobre `item_type` y `reorder_threshold`.
- Modelos/schemas Pydantic para creación, actualización, lectura.

**B — Backend: CRUD de insumos**
- Crear/editar/consultar `inventory_items` (nombre, tipo, proveedor, ciudad, umbral).
- Listado con indicador de estado (`ok` / `bajo_umbral`) calculado sobre `current_stock` vs `reorder_threshold`.

**C — Backend: transacciones y trazabilidad**
- Registrar `entrada` (compra recibida) y `consumo` (vinculado opcionalmente a una `formula_id` cuando el consumo se origina en una producción).
- `current_stock` se recalcula de forma atómica junto con la transacción (una sola operación, igual criterio que el promote atómico de Fase 2: nunca debe quedar una transacción registrada sin el stock actualizado, ni viceversa).
- Endpoint de historial de transacciones por insumo (trazabilidad completa).

**D — Alertas de reabastecimiento**
- Endpoint/vista que liste los insumos actualmente por debajo de `reorder_threshold`.
- Pensado para consultarse rápido antes de un viaje de compras a otra ciudad (agrupar por `supply_city` y `supplier` para planear la ruta de compra).

**E — Frontend: gestión de insumos**
- Pantalla de listado de inventario con indicador visual de estado (ok / bajo umbral).
- Formulario de alta/edición de insumo.

**F — Frontend: registrar transacciones + vincular a producción**
- Flujo simple para registrar entrada o consumo desde celular.
- Al registrar consumo desde la ficha de una fórmula (integración con el módulo de Fase 1), pre-cargar `formula_id` automáticamente.
- Vista de alertas de reabastecimiento agrupada por ciudad/proveedor.

## Criterios de aceptación

- El stock de un insumo siempre refleja la suma correcta de sus transacciones (nunca queda una transacción sin reflejarse en `current_stock`, ni un `current_stock` desincronizado de su historial).
- Se puede ver en segundos qué insumos están por debajo del umbral, agrupados por ciudad de compra.
- Todo consumo originado en una producción queda vinculado a la `formula_id` correspondiente.
- Toda transacción queda auditada en `access_logs`.
- Cobertura de tests backend (pytest) y frontend (vitest) en verde antes de cada merge, mismo estándar de Fases 1 y 2.

## Fuera de alcance de esta fase

- Integración con proveedores externos (cotización automática, órdenes de compra electrónicas).
- Predicción de consumo futuro basada en histórico (posible Fase 4).
- Multi-almacén o multi-sede.

## Instrucción para OpenCode

Seguir el mismo patrón de slices A→F con PRs independientes, RED antes de GREEN en cada uno, merge estándar (no squash) a `main`, y el mismo criterio de operación atómica ya validado en el promote de Fase 2 aplicado aquí a la actualización de `current_stock` junto con su transacción. Usar el ledger de presupuesto por intento con el límite de 500 líneas ya calibrado en Fase 2, salvo que el forecast de `sdd-tasks` indique lo contrario para algún slice puntual.


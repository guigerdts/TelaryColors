# Proposal: Fase 4 — Impeccable + Tarjetas Pantone + Diseños

## Intent

Elevar la calidad visual del frontend (Fases 1-3) integrando Impeccable como skill de diseño, y construir la tarjeta Pantone enriquecida — componente central que muestra código+gama, HEX, fórmula en gramos/kilo y diseños de uso — con trazabilidad de diseños vinculados a fórmulas (vía auto y manual).

## Scope

### In Scope
- A: Setup + `/impeccable audit` baseline sobre Formulas/Inventory/InventoryTransaction/InventoryAlerts/Search/Designs; documentar checklist.
- B: Retrofit visual con `/impeccable polish` guiado por audit; acento 281C `#00205B` en tema compartido.
- C: Migración aditiva `0004_designs`: `designs.client`/`designs.notes` (nullable) + tabla `formula_designs` + `inventory_transactions.design_id` (nullable); modelos/schemas Pydantic; `EXPECTED_TABLES`.
- D: CRUD `designs`; vinculación manual (`source=manual`); upsert auto en `register_transaction` (atómico); endpoint ficha extendida; auditoría `design.create`/`formula_design.create`.
- E: `PantoneCard` (spec visual sección 4) + hover vía `/impeccable animate`; consume endpoint D.
- F: Reemplazo de listados (Pantone.jsx/Search) por `PantoneCard`; flujo vincular manual; campo `design_id` en InventoryTransaction.jsx; `/impeccable critique` final.

### Out of Scope
- Reportes/exportación (PDF/Excel) → Fase 5.
- Roles granulares, multi-idioma, reconocimiento fotográfico.
- Clean-up destructivo del modelo existente.

## Modelo de datos resultante

**Decisión designs (CONFIRMADA):** extender el modelo `Design` existente (Opción 1), NO tabla paralela. `designs` y `formula_designs` son niveles de detalle distintos (color vs receta), mismo concepto de dominio.
- `designs` += `client` (nullable), `notes` (nullable) — aditivo, sin tocar API/`/designs` actual.
- `formula_designs` NUEVA (adicional a `design_colors`): `formula_id`+`design_id`, `source` enum `auto`|`manual`.
- `inventory_transactions` += `design_id` (nullable).
- `UNIQUE(formula_id, design_id)` → sin duplicados.

## Capabilities

### New Capabilities
- `formula-designs`: tabla `formula_designs`, vinculación manual + upsert auto, ficha extendida.
- `pantone-card`: componente PantoneCard (bloque color, franja PANTONE®/código+gama/HEX, fórmula+Diseños, hover).

### Modified Capabilities
- `designs`: añadir `client`/`notes` (requisitos de campo).
- `inventory`: añadir `design_id` a transacciones + upsert `formula_designs` en consumo.
- `base`/`samples`: retrofit visual Impeccable + acento 281C (deltas UI).

## Approach

Slices A→F en orden (RED/GREEN). Ficha extendida: **endpoint dedicado** (p. ej. `GET /api/v1/formulas/{id}/detail`) en vez de engordar `FormulaOut` — evita acoplar el listado heredado y cumple "fórmula + diseños sin duplicados" en una llamada. Selector de gama (C/TPX/U) como opciones reales en Slice E/F (requisito, no solo texto libre).

## Dependencias entre slices

A → B → C → D → E → F (estricto en orden). E requiere D; F requiere E.

## Riesgos

| Riesgo | Likelihood | Mitigación |
|--------|------------|------------|
| Forecast líneas A/B impreciso (depende del audit) | High | Reportar número real tras `/impeccable audit`; NO comprometer arbitrario. Presupuesto 500 líneas, split sub-PRs si excede |
| Migración en designs existentes | Low | `0004` aditiva; `alembic downgrade` seguro |
| Duplicados en `formula_designs` | Med | `UNIQUE(formula_id, design_id)` + upsert |
| Sobre-reescritura de paleta | Med | 281C solo como acento, no fondo dominante |

## Rollback Plan

- Migración: `alembic downgrade` revierte `0004` (solo tablas/columnas nuevas; datos 1-3 intactos).
- Endpoint ficha: revert a `/api/v1/formulas/{id}` estándar.
- UI: revert commit del slice (retrofit visual aislado por slice/PR).

## Dependencies

- Impeccable skill YA instalado en `/root/.opencode/skills/impeccable/` (no requiere npx install).

## Criterios de aceptación (mapeados a slices)

- [ ] **A/B**: toda pantalla 1-3 auditada con Impeccable; hallazgos atendidos o documentados (out of scope).
- [ ] **E**: tarjeta muestra código+gama, HEX, fórmula g/kilo y diseños de uso, con hover elevación.
- [ ] **D/F**: diseño vinculable a fórmula por vía automática (transacción etiquetada) y manual.
- [ ] **C/D**: `formula_designs` nunca duplica el par formula_id/design_id.
- [ ] **D/E**: ficha extendida devuelve fórmula + diseños sin duplicados en una llamada.
- [ ] **B**: acento 281C en tema compartido como marca (no fondo dominante).
- [ ] **C**: pytest + vitest en verde antes de cada merge (mismo estándar 1-3).

## Success

- Retrofit Impeccable aplicado al frontend existente.
- Tarjeta Pantone funcional consumiendo la ficha extendida.
- Vinculación auto+manual sin duplicados, cubierta por tests.
- Cobertura backend+frontend en verde.

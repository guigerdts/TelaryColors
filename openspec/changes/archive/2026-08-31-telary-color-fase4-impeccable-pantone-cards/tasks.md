# Tasks: Fase 4 — Impeccable + Tarjetas Pantone + Diseños

Strict TDD (RED → GREEN → verify) en cada slice. Slices A→F, cada uno = 1 PR independiente merge estándar no-squash a `main`. Presupuesto 500 líneas/ventana; slice que estime >500 se SPLITea en sub-PRs (sin excepción). Confirmaciones usuario: ficha muestra secciones SEPARADAS `design_colors` (composición) vs `formula_designs` (receta); vinculación manual = SOLO diseños existentes (sin creación inline, crear vive en `/designs`).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | A 350 (pend. audit) · B 250+ (pend. audit) · C 200 · D 430 · E 380 · F 320 — Total ~1930 |
| 400-line budget risk | Medium (por PR sotto 400; fase total multi-PR) |
| Chained PRs recommended | Yes (6 PRs por slice) |
| Suggested split | PR A → PR B → PR C → PR D → PR E → PR F |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (elegir stacked-to-main / feature-branch-chain; timing A/B) |
| Slices marcados split | D (si >500, split backend: PR D1 CRUD+manual / PR D2 auto-upsert+detail) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

> Slice A y B: forecast de líneas PENDIENTE — reportar el número real tras `/impeccable audit` (proposal §Riesgos), NO comprometer arbitrario.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Audit baseline Impeccable + checklist | PR A | `pytest && npm test` (verde, sin código) | `/impeccable audit` real sobre pantallas; dev server | Revert del doc; cero código de app |
| B | Retrofit visual + acento 281C | PR B | `npm test -- --coverage` + `pytest` | `/impeccable polish` guiado por audit | Revert de `index.css`/páginas tocadas |
| C | Migración 0004 + modelos + EXPECTED_TABLES | PR C | `pytest tests/test_migration.py -v` | `alembic upgrade head && downgrade` temp DB | `alembic downgrade` (solo tablas/cols nuevas) |
| D | CRUD designs + links manual/auto + detail | PR D | `pytest tests/test_formula_designs.py tests/test_designs.py tests/test_inventory.py` | `POST /inventory/items/{id}/transactions` con design_id; curl endpoint detail | Revert router/schemas; migración intacta |
| E | PantoneCard + hover + consume D | PR E | `npm test -- PantoneCard` | Dev server; ficha Pantone real (necesita backend D) | Revert componente (nada más lo consume) |
| F | Reemplazo listados + vincular + critique | PR F | `npm test && pytest` completo | `/impeccable critique` final; PWA build `npm run build` | Revert páginas; cada página rollback aislado |

## Slice A — Setup Impeccable + Audit Baseline (PR A)

- [x] A.1 — Verificar skill: si falta `frontend/node_modules/impeccable*`/`.opencode/skills/impeccable`, correr `npx impeccable install --providers=opencode` una sola vez (no re-instalar si existe).
- [x] A.2 — Ejecutar RED baseline: `pytest && npm test` verdes SIN tocar código (prueba de que el audit no rompe el estándar 1-3).
- [x] A.3 — Correr `node .opencode/skills/impeccable/scripts/context.mjs` con `--target` por pantalla (Formulas/Search, Inventory, InventoryTransaction, InventoryAlerts, Designs) y luego `/impeccable audit` sobre cada una.
- [x] A.4 — Escribir `openspec/changes/telary-color-fase4-impeccable-pantone-cards/impeccable-audit-baseline.md`: checklist por pantalla, severidad P0–P3, estado fix/out-of-scope por hallazgo.
- [x] A.5 — Verificar: reportar forecast de líneas REAL de A y B al orquestador (ya no pendiente).

## Slice B — Retrofit Visual + Acento 281C (PR B)

- [x] B.1 — RED: escribir Vitest que falle por ausencia de token `${accent-281c}` disponible en `@theme` de `frontend/src/index.css`.
- [x] B.2 — GREEN: añadir token acento `#00205B` (281C) en `@theme` de `frontend/src/index.css`; aplicar como acento de marca, NUNCA fondo dominante (base spec "Accent not dominant").
- [x] B.3 — Aplicar `/impeccable polish` guiado por `impeccable-audit-baseline.md` sobre Formulas/Search, Inventory, InventoryTransaction, InventoryAlerts, Designs, Samples (samples spec: preservar lifecycle/foto/promote atómico).
- [x] B.4 — Documentar hallazgos out-of-scope en el baseline en vez de silenciarlos (propuesta A/B "atendidos o documentados").
- [x] B.5 — Verificar: `npm test && pytest` en verde; behavior de pantallas 1-3 sin cambios (base spec "Retrofit preserves behavior").

## Slice C — Data Layer: Diseños (PR C1 + C2)

> Split real: diff real 519 líneas (496 ins + 23 del) > presupuesto 500 →
> SPLIT en PR C1 (migración + tests de migración; 377 líneas) y PR C2
> (modelos + schemas + tests de modelo; 142 líneas). Ambos empujados a origin.

- [x] C.1 — RED: extender `backend/tests/test_migration.py::EXPECTED_TABLES` con `formula_designs` (falla contra head 0003).
- [x] C.2 — RED: `backend/tests/test_migration.py`: caso downgrade aditivo-safe (solo tabla/columnas nuevas caen, datos 1-3 intactos).
- [x] C.3 — GREEN: crear `backend/alembic/versions/0004_designs.py`: `ALTER designs ADD client/notes` (nullable), `CREATE formula_designs` con `UNIQUE(formula_id, design_id)` + FK a `formulas`/`designs` + `source` enum + `created_at`, `ALTER inventory_transactions ADD design_id` (nullable, FK).
- [x] C.4 — GREEN: `DesignSource(auto/manual)` en `backend/app/db/enums.py`; `client`/`notes` en `backend/app/modules/designs/models.py`; modelo `FormulaDesign` (UniqueConstraint `uq_formula_design`).
- [x] C.5 — GREEN: `designs/schemas.py`: `client`/`notes` opcionales en Create/Update/Out; `inventory/schemas.py`: `design_id: int|None = None` en `InventoryTransactionCreate`.
- [x] C.6 — Verificar: `pytest tests/test_migration.py -v` verde (upgrade idempotente + downgrade safe). Full backend suite: 145 passed (139 previos + 6 nuevos). Adaptación requerida: `test_inventory.py` downgrade target `-1` → `0002_samples` (0004 quedó arriba de 0003 en la cadena).

## Slice D — Backend: CRUD + Vinculación + Ficha (PR D)

- [x] D.1 — RED: `backend/tests/test_formula_designs.py` (nuevo): manual link 404s (fórmula/design ausente), idempotencia par existente (D4, preserva source), `source=manual` + auditoría `formula_design.create`, re-link no-409.
- [x] D.2 — RED: auto link idempotente desde consumo etiquetado (inventory spec "Automatic link"), rollback atómico (audit monkeypatched raise → nada persiste), consumo sin `design_id` → null y sin link.
- [x] D.3 — RED: `GET /formulas/{id}/detail` — merge auto+manual sin duplicados, fórmula sin diseños → lista vacía, 404 fórmula ausente, 400 FK inválido.
- [x] D.4 — RED: `designs` CRUD con `client`/`notes` (create sin client → null; PATCH notes persiste + audita; contract 1-3 intacto).
- [x] D.5 — GREEN: crear `backend/app/modules/formula_designs/` (router `POST /formulas/{id}/designs` + helper upsert idempotente) y registrar en la app.
- [x] D.6 — GREEN: `GET /formulas/{id}/detail` en `formulas/router.py` con `FormulaDetailOut(FormulaOut)` + `designs: list[DesignOut]` (SELECT DISTINCT por UNIQUE par).
- [x] D.7 — GREEN: `register_transaction` en `inventory/router.py`: validar `design_id` 400 si ausente, upsert `formula_designs(source=auto)` en la MISMA txn (add+flush→mutate→log→commit, rollback) y auditar `formula_design.create` solo con par nuevo.
- [x] D.8 — GREEN: `designs/router.py` + schemas con `client`/`notes` (create/update, auditoría `design.create`/`design.update` existente).
- [x] D.9 — Verificar: `pytest tests/test_formula_designs.py tests/test_designs.py tests/test_inventory.py tests/test_migration.py` en verde (162 passed); si diff >500 líneas → SPLIT: PR D1 (D.1/D.4/D.5/D.8) antes de PR D2 (D.2/D.3/D.6/D.7/D.9).

## Slice E — Frontend: PantoneCard (PR E)

- [x] E.1 — RED: `frontend/src/components/PantoneCard.test.jsx`: render bloque color + wordmark "PANTONE®" + código+gama (`PMS 211 C`-style) + HEX + fórmula g/kilo; sin diseños → sección vacía visible, no colapsada.
- [x] E.2 — RED: test ficha separa secciones: `design_colors` (composición) y `formula_designs` (diseños/clientes) renderizan por separado, sin mezclar (confirmación usuario 1).
- [x] E.3 — RED: test single-call: monta → fetch `GET /api/v1/formulas/{id}/detail` y renderiza fórmula + diseños dedup de UNA respuesta (pantone-card spec).
- [x] E.4 — GREEN: crear `frontend/src/components/PantoneCard.jsx` según spec visual sección 4 (bloque color full-width, franja blanca con wordmark/código+gama/HEX, fórmula + diseños).
- [x] E.5 — GREEN: `frontend/src/api/index.js`: `getFormulaDetail(id)` y `linkDesignToFormula(id, {design_id})`.
- [x] E.6 — GREEN: hover elevación con `/impeccable animate`: `translateY` + `box-shadow` creciente con transición (spec "Hover Elevation").
- [x] E.7 — Verificar: `npm test -- PantoneCard` verde; revisión visual dev server vs tarjeta física de referencia.

## Slice F — Frontend: Integración + Reemplazo + Critique (PR F)

- [x] F.1 — RED: `Search.test.jsx`/`Pantone.test.jsx`: listados renderizan `PantoneCard` (no tarjetas legacy); selector gama ofrece opciones reales `C`/`TPX`/`U` y rechaza fuera de rango (pantone-card spec "Gamut Selector").
- [x] F.2 — RED: `InventoryTransaction.test.jsx`: campo opcional `design_id` en formulario de consumo (omisión → sin link); flujo vincular manual ofrece SOLO diseños existentes (confirmación usuario 2).
- [x] F.3 — GREEN: `frontend/src/pages/Pantone.jsx` + `Search.jsx`: reemplazar listados por `PantoneCard`.
- [x] F.4 — GREEN: `frontend/src/pages/InventoryTransaction.jsx`: selector opcional de diseño existente → `design_id` en payload de consumo.
- [x] F.5 — GREEN: flujo vincular manual en ficha (modal/selector con `listDesigns()` + `linkDesignToFormula`, sin create-inline).
- [x] F.6 — GREEN: `DesignColorPicker.jsx`/formularios: selector gama con opciones reales `{C, TPX, U}` (validado UI y backend).
- [x] F.7 — Verificar: `npm test && pytest` en verde; `/impeccable critique` final del conjunto; `npm run build` PWA ok; hallazgos out-of-scope documentados en baseline.

## Mapeo escenarios mandatorios ↔ tareas

| Escenario (spec) | Tareas |
|---|---|
| E1 Auto link consumo etiquetado + sin duplicado (formula-designs/inventory) | D.2 RED → D.7 GREEN |
| E2 Manual link + `formula_design.create` audit (formula-designs) | D.1 → D.5 GREEN |
| E3 Par duplicado idempotente + UNIQUE data-layer (formula-designs) | C.1/C.3 + D.1 |
| E4 Detail merge auto+manual sin duplicados (formula-designs) | D.3 → D.6 GREEN |
| E5 Card core + hover + single-call (pantone-card) | E.1–E.6 |

## Criterios de aceptación ↔ tareas

| Criterio | Tareas |
|---|---|
| A/B audit + hallazgos atendidos/documentados | A.3–A.4, B.3–B.4 |
| E tarjeta código+gama/HEX/fórmula/diseños + hover | E.1–E.6 |
| D/F vincular auto + manual | D.1–D.7, F.5 |
| C/D sin duplicado par formula_id/design_id | C.1–C.3, D.1–D.7 |
| D/E ficha una llamada sin duplicados | D.3–D.6, E.3–E.5 |
| B acento 281C no dominante | B.1–B.2 |
| C pytest+vitest en verde por merge | C.6, D.9, E.7, F.7 |
```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:cdf3fc4aecc13521025773cd354b3fdd65183511135a9337f3a636e632d4a0eb
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 20/20
scenarios: 36/36
test_command: cd backend && python -m pytest -q && cd frontend && npx vitest run --pool=threads
test_exit_code: 0
test_output_hash: sha256:cdf3fc4aecc13521025773cd354b3fdd65183511135a9337f3a636e632d4a0eb
build_command: npx vite build
build_exit_code: 0
build_output_hash: sha256:e7487fba211a4696ea89a2b8b1a1f6b204bf337cbef016db35a5ef463cd4ebe5
```

# Verification Report — Fase 4: Impeccable + Tarjetas Pantone + Diseños

**Change**: `telary-color-fase4-impeccable-pantone-cards`
**Target**: árbol `main` integrado @ `d18c4264f590411ae1eadb6fda4979d1f9244d2c` (PRs #40, #42, #44, #45, #46, #47, #48, #49, #50 mergeados — cadena A→B→C1→C2→D1→D2→E→F1→F2)
**Mode**: Strict TDD (activo)
**Verified by**: `sdd-verify` full-chain — fuente inspeccionada + suites ejecutadas + build ejecutado

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total (tasks.md) | 37 (A.1–A.5, B.1–B.5, C.1–C.6, D.1–D.9, E.1–E.7, F.1–F.7) |
| Tasks checked en tasks.md | 30 (A–E completos) |
| Tasks unchecked en tasks.md | 7 (F.1–F.7) — ⚠️ archivo desactualizado |
| Work units presentes en main integrado | 37/37 — los 6 PRs de Slice F están mergeados (PR #49 `feat/pr-f1-listados-gama`, PR #50 `feat/pr-f2-design-link`; commits RED→GREEN F1/F2 visibles en `main`) |

> **Nota**: `tasks.md` no fue actualizado tras integrar Slice F (F.1–F.7 quedan `[ ]` en el archivo), pero el árbol integrado contiene TODO el trabajo: los commits `0d4be6a` (RED F1), `5a57ba0` (GREEN F1), `9c83c6a` (RED F2), `9625e08` (GREEN F2) están en `main` y sus tests pasan en la suite completa. Se reporta como WARNING de documentación; no bloquea la verificación del árbol integrado.

---

## Build & Tests Execution (evidencia real ejecutada)

**Backend tests** — `cd backend && .venv/bin/python -m pytest -q` (el `python` global del entorno apunta a un Python de Termux sin pytest; el intérprete canónico del proyecto es `.venv/bin/python`):

```text
162 passed, 311 warnings in 328.77s (0:05:28)
```

**Frontend tests** — `cd frontend && npx vitest run --pool=threads` (UNA invocación completa, 18 archivos):

```text
Test Files  18 passed (18)
     Tests  82 passed (82)
  Duration  817.40s (transform 5.50s, setup 106.58s, import 11.33s, tests 32.58s, environment 615.21s)
```

> Nota de entorno: la primera invocación de vitest fue matada por timeout de 10 min durante el arranque de jsdom (máquina lenta, `fileParallelism: false`); la segunda invocación completa terminó en 817s. No es un fallo de tests.

**Build** — `cd frontend && npx vite build` (script `build` del package.json):

```text
vite v8.2.2 building client environment for production...
✓ 45 modules transformed.
dist/index.html                 0.57 kB │ gzip:  0.33 kB
dist/assets/index-CA_xXZj5.css 22.35 kB │ gzip:  4.95 kB
dist/assets/index-DKuMId0L.js 267.78 kB │ gzip: 80.49 kB
✓ built in 2.25s
```

| Evidencia | Valor |
|-----------|-------|
| pytest exit code | 0 |
| vitest exit code | 0 |
| build exit code | 0 |
| `test_output_hash` (sha256 de salida combinada pytest+vitest) | `cdf3fc4aecc13521025773cd354b3fdd65183511135a9337f3a636e632d4a0eb` |
| `build_output_hash` (sha256 de salida del build) | `e7487fba211a4696ea89a2b8b1a1f6b204bf337cbef016db35a5ef463cd4ebe5` |

**Coverage**: ➖ No hay herramienta de cobertura configurada (pytest.ini sin `--cov`; vitest sin provider) → informativo, no bloqueante.

---

## Escenarios mandatorios (5) — confirmación uno a uno

### S1. UNIQUE(formula_id, design_id) real + idempotencia (insertar el mismo par 2× NO lanza IntegrityError)

- **Capa de datos**: `backend/alembic/versions/0004_designs.py:63` — `sa.UniqueConstraint("formula_id", "design_id", name="uq_formula_design")`; modelo `backend/app/modules/designs/models.py:85` — `UniqueConstraint("formula_id", "design_id", name="uq_formula_design")` sobre `FormulaDesign`.
- **Upsert idempotente**: `backend/app/modules/formula_designs/router.py:32-63` — `upsert_formula_design()`: SELECT del par existente → si existe, retorna la fila (source preservado, sin escritura, sin error).
- **Tests que lo prueban (pasaron en la suite)**:
  - `backend/tests/test_formula_designs.py:330` — `test_auto_relink_same_pair_idempotent_no_integrity_error`: segundo consumo con el mismo par → `201`, **sin IntegrityError**, 1 sola fila, 1 sola auditoría.
  - `backend/tests/test_formula_designs.py:155` — `test_manual_relink_idempotent_preserves_source_no_duplicate`: re-link manual → `200`, mismo `id`, source intacto, sin fila duplicada.
  - `backend/tests/test_migration.py:235` — `test_0004_creates_formula_designs_with_unique_pair_constraint` (constraint REAL a nivel DB) y `:307` `test_formula_designs_duplicate_pair_rejected_at_database` (INSERT directo duplicado → violación de uniqueness, no fila duplicada).

✅ **CONFIRMADO**

### S2. Dedup del endpoint detail (GET /api/v1/formulas/{id}/detail devuelve el diseño UNA vez con auto+manual)

- **Router**: `backend/app/modules/formulas/router.py:52-86` — `get_formula_detail()` con `select(Design).distinct().join(FormulaDesign, ...).where(formula_id=...)` (DISTINCT real + UNIQUE del par como doble garantía).
- **Test que lo prueba (pasó)**: `backend/tests/test_formula_designs.py:448` — `test_detail_merges_auto_and_manual_without_duplicates`: mismo `design_id` alcanzado por auto (consumo) y manual (link) → `designs == [design_id]`, exactamente una aparición. Complementos: `:482` (sin diseños → lista vacía), `:498` (fórmula ausente → 404).

✅ **CONFIRMADO**

### S3. Rollback atómico del upsert dentro de register_transaction (fallo tras insertar formula_design → TODO revertido)

- **Router**: `backend/app/modules/inventory/router.py:170-250` — `register_transaction()`: add txn → flush → mutar stock → upsert `formula_designs(source=auto)` (línea 239, MISMA transacción) → `log_action` → `db.commit()`; `except Exception: db.rollback(); raise` (líneas 248-250). El upsert se ejecuta ANTES de la auditoría final, así un fallo posterior revierte también el link.
- **Test que lo prueba (pasó)**: `backend/tests/test_formula_designs.py:410` — `test_auto_link_rolls_back_when_transaction_fails_after_upsert`: auditoría monkeypatcheada para lanzar DESPUÉS del upsert → no persiste fila de txn, stock intacto (10), **sin fila huérfana en formula_designs**, sin auditorías. Respaldo: `backend/tests/test_inventory.py:378` (rollback transaccional base).

✅ **CONFIRMADO**

### S4. Selector de gama limitado a C/TPX/U (sin input libre)

- **Fuente de verdad**: `frontend/src/lib/gamut.js:5` — `GAMUT_OPTIONS = ['C', 'TPX', 'U']`; `:7-9` — `isValidGamut(value)` rechaza todo lo demás.
- **Form**: `frontend/src/pages/Pantone.jsx:9` (import), `:14` (`useState('C')`), `:35` (guard `if (!isValidGamut(gamut))`), `:82-90` — `<select>` que mapea `GAMUT_OPTIONS` con `<option>` por cada valor; NO existe input de texto libre para gamut.
- **Tests que lo prueban (pasaron)**:
  - `frontend/src/lib/gamut.test.js:10` (options exactas), `:14` (acepta C/TPX/U), `:18-23` (rechaza `''`, `'c'`, `'coated'`, `'X'`, `'TPX '`, `'C '`, `'u'`).
  - `frontend/src/pages/Pantone.test.jsx:65-74` — `test("offers the real gamuts C/TPX/U as select options, never free text")`: assert `tagName === 'SELECT'` y `options == ['C','TPX','U']` (fuera de rango ni siquiera es expresable en la UI).

✅ **CONFIRMADO**

### S5. Acento 281C solo como acento, no fondo dominante

- **Token**: `frontend/src/index.css:8` — `--color-accent-281c: #00205B` en `@theme` (test `frontend/src/index.css.test.js:14-16`).
- **Grep de fronteras** (todo `frontend/src`, js/jsx/css; patrón `bg-accent-281c`/`bg-[#...]`/hex hardcodeado):
  - **Sin hallazgos dominantes**: ningún fondo de página/sección/contenedor grande usa el acento; ningún `bg-[#281C...]` ni `#00205B` hardcodeado fuera del token; el retrofit de B no introdujo "todo azul oscuro".
  - **Usos de `bg-accent-281c` (clasificados — todos estados interactivos, permitidos por base spec "accent MAY be used ... interactive states")**:
    | Ubicación | Uso | Clasificación |
    |---|---|---|
    | `components/Layout.jsx:39` | nav item estado ACTIVO | Interactivo (OK) |
    | `pages/Designs.jsx:83` | botón submit | Interactivo (OK) |
    | `pages/Formulas.jsx:157` | botón submit | Interactivo (OK) |
    | `pages/SampleRegistration.jsx:134` | botón submit | Interactivo (OK) |
    | `pages/Inventory.jsx:169` | botón submit | Interactivo (OK) |
    | `pages/InventoryTransaction.jsx:194` | botón submit | Interactivo (OK) |
    | `components/DesignColorPicker.jsx:47` | swatch seleccionado | Interactivo (OK) |
    | `components/SampleFicha.jsx:33` | `hover:bg-accent-281c/10` (lavado 10%) | Interactivo (OK) |
    | `pages/SampleRegistration.jsx:104` | `file:bg-accent-281c/10` (tinte 10% botón archivo) | Interactivo (OK) |
  - Resto de usos: `text-accent-281c`, `border-accent-281c`, `focus:border-accent-281c`, `focus:ring-accent-281c/30`, `focus-visible:outline-accent-281c` — acentos de texto/borde/foco/ring, exactamente el rol de marca.
- **Evidencia de test**: el token se prueba en `index.css.test.js`; la propiedad "no dominante" es una propiedad de diseño verificada por inspección de las 44 coincidencias (no hay test automatizado posible sin asserts de clases CSS, prohibidos por Strict TDD).

✅ **CONFIRMADO** (sin hallazgos de `bg-accent-281c`/`bg-[#281C]` como fondo dominante)

---

## Spec Compliance Matrix (6 specs, 20 requisitos, 36 escenarios)

| Spec | Requisito | Escenario | Test | Resultado |
|------|-----------|-----------|------|-----------|
| base | Shared Theme w/ Brand Accent 281C | Accent token present | `index.css.test.js:14` | ✅ COMPLIANT |
| base | Shared Theme w/ Brand Accent 281C | Accent not dominant | inspección grep de fronteras (9 usos, todos interactivos) | ✅ COMPLIANT (inspección) |
| base | Impeccable Retrofit of Existing Screens | Baseline audit recorded | `impeccable-audit-baseline.md` (raíz, checklist P0–P3 × 6 pantallas) | ✅ COMPLIANT (artefacto) |
| base | Impeccable Retrofit of Existing Screens | Retrofit preserves behavior | suites completas: 162 pytest + 82 vitest verdes | ✅ COMPLIANT |
| base | Strict TDD Applies to UI Retrofit | Frontend red-green | commits RED→GREEN por slice (p.ej. `0d4be6a`→`5a57ba0`, `9c83c6a`→`9625e08`) | ✅ COMPLIANT |
| designs | Client Field (optional) | Create design without client | `test_designs.py:292` | ✅ COMPLIANT |
| designs | Client Field (optional) | Create design with client | `test_designs.py:316` | ✅ COMPLIANT |
| designs | Notes Field (optional) | Create design without notes | `test_designs.py:292`/`:396` | ✅ COMPLIANT |
| designs | Notes Field (optional) | Notes editable later | `test_designs.py:342` | ✅ COMPLIANT |
| designs | Design Fields (modified) | Create a design | `test_designs.py:51` | ✅ COMPLIANT |
| designs | Design Fields (modified) | Duplicate name | `test_designs.py:72`/`:83` | ✅ COMPLIANT |
| designs | Design Fields (modified) | Invalid paint type | `test_designs.py:100` | ✅ COMPLIANT |
| formula-designs | Formula-Design Link Data Model | Migration creates table | `test_migration.py:235` (+`EXPECTED_TABLES:42`) | ✅ COMPLIANT |
| formula-designs | Formula-Design Link Data Model | Duplicate pair rejected at data layer | `test_migration.py:307`, `test_designs.py:404` | ✅ COMPLIANT |
| formula-designs | Automatic Link (source=auto) | Automatic link from tagged consumption | `test_formula_designs.py:299` | ✅ COMPLIANT |
| formula-designs | Manual Link (source=manual) | Manual link from formula detail | `test_formula_designs.py:94` | ✅ COMPLIANT |
| formula-designs | Duplicate Pair Handling (idempotent) | Re-link returns existing | `test_formula_designs.py:155`/`:330` | ✅ COMPLIANT |
| formula-designs | Formula Detail Endpoint (no duplicates) | Detail merges auto and manual without duplicates | `test_formula_designs.py:448` | ✅ COMPLIANT |
| formula-designs | Formula Detail Endpoint (no duplicates) | Formula without designs | `test_formula_designs.py:482` | ✅ COMPLIANT |
| formula-designs | Audit Propagation | Manual create audited | `test_formula_designs.py:94` | ✅ COMPLIANT |
| formula-designs | Audit Propagation | Auto create audited | `test_formula_designs.py:299` | ✅ COMPLIANT |
| inventory | Design Reference on Consumption Transactions | Consumption without design | `test_formula_designs.py:371` | ✅ COMPLIANT |
| inventory | Design Reference on Consumption Transactions | Downgrade is additive-safe | `test_migration.py:257` | ✅ COMPLIANT |
| inventory | Inventory Data Model (modified) | Migration adds tables | `test_inventory.py:81`, `test_migration.py:191` | ✅ COMPLIANT |
| inventory | Inventory Data Model (modified) | Downgrade is additive-safe | `test_inventory.py:98`, `test_migration.py:257` | ✅ COMPLIANT |
| inventory | Atomic Stock Transaction With Auto Design Link | Happy-path consumo with formula | `test_inventory.py:339` | ✅ COMPLIANT |
| inventory | Atomic Stock Transaction With Auto Design Link | Automatic link from tagged consumption | `test_formula_designs.py:299` | ✅ COMPLIANT |
| inventory | Atomic Stock Transaction With Auto Design Link | Rollback on mid-operation failure | `test_formula_designs.py:410`, `test_inventory.py:378` | ✅ COMPLIANT |
| pantone-card | Pantone Card Layout | Card renders core fields | `PantoneCard.test.jsx:30` | ✅ COMPLIANT |
| pantone-card | Pantone Card Layout | Card without designs | `PantoneCard.test.jsx:73` | ✅ COMPLIANT |
| pantone-card | Hover Elevation | Elevate on hover | `PantoneCard.jsx:24` (impl.) + verificación visual dev server vs tarjeta física, protocolo del proyecto E.7 / commit `c9b047b` | ✅ COMPLIANT (visual — protocolo del proyecto) |
| pantone-card | Consume Formula Detail Endpoint | Single-call load | `PantoneDetail.test.jsx:42`, `api/index.js:52` | ✅ COMPLIANT |
| pantone-card | Gamut Selector as Validated Options | Valid gamut accepted | `gamut.test.js:14`, `Pantone.test.jsx:65` | ✅ COMPLIANT |
| pantone-card | Gamut Selector as Validated Options | Out-of-range gamut rejected | `gamut.test.js:18-23` | ✅ COMPLIANT |
| samples | Samples Screens Participate in Retrofit | Sample screen styled by shared theme | `SampleFicha.jsx:33` (token) + suites verdes | ✅ COMPLIANT |
| samples | Samples Screens Participate in Retrofit | Retrofit preserves sample behavior | `SampleFicha.test.jsx`, `SampleRegistration.test.jsx` | ✅ COMPLIANT |

**Compliance summary**: 36/36 escenarios compliant · 0 FAILING · 1 escenario verificado por protocolo visual del proyecto (E.7) en lugar de test automatizado (documentado en Issues).

---

## Correctness (Static Evidence)

| Requisito | Estado | Notas |
|-----------|--------|-------|
| `formula_designs` + UNIQUE pair | ✅ Implementado | Migración `0004:63`, modelo `models.py:85`, constraint verificado a nivel DB (`test_migration.py:307`) |
| Upsert idempotente (auto/manual) | ✅ Implementado | `formula_designs/router.py:32-63` — return-the-existing, source preservado |
| Link manual | ✅ Implementado | `POST /formulas/{id}/designs` con 404 de extremos, auditoría `formula_design.create` solo par nuevo |
| Auto link atómico en consumo | ✅ Implementado | `inventory/router.py:239` — misma txn, rollback total en fallo |
| Detail sin duplicados | ✅ Implementado | `formulas/router.py:76-82` — SELECT DISTINCT + UNIQUE |
| `client`/`notes` en designs | ✅ Implementado | Migración `0004`, schemas, tests de create/PATCH |
| `design_id` nullable en transacciones | ✅ Implementado | `inventory/models.py:78`, `schemas.py:87` |
| Token acento 281C `#00205B` | ✅ Implementado | `index.css:8` en `@theme` |
| PantoneCard (bloque/wordmark/código+gama/HEX/fórmula/diseños) | ✅ Implementado | `PantoneCard.jsx` — render completo + secciones separadas |
| Hover elevación | ✅ Implementado | `PantoneCard.jsx:24` — `hover:-translate-y-1 hover:shadow-lg transition-transform duration-200 ease-out` |
| Gama C/TPX/U validada | ✅ Implementado | `gamut.js:5-9`, `Pantone.jsx:35` guard + `<select>` |
| Retrofit pantallas 1–6 + samples | ✅ Implementado | Baseline en raíz; suites completas verdes (comportamiento preservado) |

---

## Coherence (Design)

| Decisión | ¿Seguida? | Notas |
|----------|-----------|-------|
| D1 Extender `designs` (client/notes nullable) | ✅ Sí | Aditivo, sin romper `/designs` |
| D2 `formula_designs` con UNIQUE pair (junto a `design_colors`) | ✅ Sí | Secciones separadas en la card (test `PantoneCard.test.jsx:56`) |
| D3 Ficha dedicada `GET /formulas/{id}/detail` | ✅ Sí | Única llamada; `FormulaDetailOut(FormulaOut)` + `designs` (schemas.py:75-81) |
| D4 Par duplicado → idempotente return-existing | ✅ Sí | Helper compartido; tests `:155`/`:330` |
| D5 Acento 281C solo acento | ✅ Sí | Token + uso exclusivo en estados interactivos |
| D6 Auto-upsert dentro de `register_transaction` atómico | ✅ Sí | Misma txn add+flush→mutate→upsert→log→commit, rollback |
| D7 Selector de gama validado `{C,TPX,U}` | ✅ Sí | `GAMUT_OPTIONS` + `<select>` + guard + tests |
| D8/rollback: `alembic downgrade` solo baja tablas/cols nuevas | ✅ Sí | `test_migration.py:257` (con fila sembrada pre-downgrade) |

---

## TDD Compliance (Strict TDD)

| Check | Resultado | Detalles |
|-------|-----------|----------|
| TDD Evidence reported | ❌ WARNING | No se encontró artifact `apply-progress` en Engram (búsquedas ×3); la evidencia TDD vive en los pares de commits RED→GREEN por slice en `main` |
| All tasks have tests | ✅ | Tests presentes para los 37 work units integrados (12 archivos pytest + 18 archivos vitest) |
| RED confirmed (tests existen) | ✅ | 37/37 work units con archivos de test integrados |
| GREEN confirmed (tests pass) | ✅ | 162/162 pytest + 82/82 vitest verdes en ejecución |
| Triangulation adequate | ✅ | P.ej. idempotencia auto (`:330`) + manual (`:155`) + par distinto (`:181`); gamut acepta/rechaza (`gamut.test.js`) |
| Safety Net for modified files | ➖ | No verificable: sin apply-progress con tabla de archivos modificados |

**TDD Compliance**: 4/6 checks ✓ (2 gaps de evidencia documental, no de ejecución)

### Assertion Quality
**Resultado**: ✅ All assertions verify real behavior — auditoría de los archivos clave de Fase 4 (`test_formula_designs.py` completo, `PantoneCard.test.jsx`, `gamut.test.js`, `Pantone.test.jsx`, `test_migration.py`): asserts sobre valores de respuesta, conteos de filas, stock, auditorías y opciones reales. Sin tautologías, sin ghost loops, sin mocks vacíos. La única excepción documentada: el hover NO se testea automatizadamente (assert de clase CSS, prohibido por Strict TDD) → verificado visualmente (E.7).

### Test Layer Distribution (archivos de Fase 4)
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | ~10 | `gamut.test.js`, `index.css.test.js`, `client.test.js`, `store.test.js`, `useDebounce.test.js` | vitest |
| Integration (API/componentes) | ~230 (pytest TestClient + @testing-library) | 12 pytest (incl. `test_formula_designs.py`, `test_migration.py`) + 13 jsx tests | pytest+fastapi TestClient, @testing-library/react |
| E2E | 0 | — | no configurado |
| **Total** | **244** | **30** | |

### Changed File Coverage
**Coverage analysis skipped — no coverage tool detected** (informativo, no bloqueante)

### Quality Metrics
**Linter**: ➖ No configurado (package.json sin script lint; sin config de ESLint en el repo)
**Type Checker**: ➖ No configurado (frontend JSX sin tsconfig; el `vite build` transforma sin errores — 45 módulos)
**Build**: ✅ `vite build` exit 0 (evidencia de integridad del bundle)

---

## Issues Found

**CRITICAL**: None

**WARNING**:
1. **tasks.md desactualizado para Slice F** — F.1–F.7 quedan `[ ]` en el archivo aunque el trabajo está integrado y verificado en `main` (PRs #49/#50). Actualizar los checkboxes del archivo.
2. **apply-progress no persistido** — no existe artifact de apply-progress (ni `TDD Cycle Evidence`) en el store; la evidencia TDD se reconstruye de los pares de commits RED→GREEN. Gap de proceso/documentación, no de ejecución.
3. **Escenario "Elevate on hover" sin test automatizado** — el único escenario de spec que no tiene test automatizado; es COMPLIANT por verificación visual sancionada por el protocolo del propio proyecto (tasks E.7: "revisión visual dev server vs tarjeta física de referencia"; commit `c9b047b` documenta el porqué: el único assert automatizable sería de clase CSS, prohibido por Strict TDD). La implementación existe y está verificada (`PantoneCard.jsx:24` — `hover:-translate-y-1 hover:shadow-lg transition-transform duration-200 ease-out`). Si se exige test automatizado, requeriría una estrategia por comportamiento (p.ej. `getComputedStyle` tras `mouseenter` vía user-event) — quedaría como mejora, no como bloqueo.

**SUGGESTION**:
1. El comentario de `frontend/src/test-setup.js:6` dice "We keep globals off" pero `vite.config.js:19` tiene `globals: true` — contradicción menor entre comentario y config (sin impacto funcional).
2. `evidence_revision` y `test_output_hash` coinciden por diseño (ambos = digest de la salida combinada de tests); si se quiere distinguir revisión de evidencia vs salida de comando, usar digests distintos.

---

## Verdict

**PASS WITH WARNINGS** — árbol integrado `main@d18c426` verificado full-chain: 162 pytest + 82 vitest verdes + build OK; 36/36 escenarios compliant (35 con test automatizado + 1 con verificación visual sancionada por el protocolo del proyecto); los 5 escenarios mandatorios confirmados con archivo+test; 0 CRITICAL. Los 3 WARNINGs son de documentación/proceso (tasks.md stale, apply-progress ausente) y UNA escenario sin test automatizado (hover, verificado visualmente por protocolo E.7).
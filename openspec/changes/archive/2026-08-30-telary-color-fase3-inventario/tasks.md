# Tasks: Inventario y Trazabilidad (Fase 3)

## Open Question Resolution (design adjustment, sanctioned)

Fase 2 has NO formula ficha route (`/formulas/:id` absent; `Formulas.jsx` list is presentational — zero `Link`/`useNavigate`/`useParams` in the app). Resolution: **keep design's `?formula_id=` mechanism** (F1 contract, ADR-2/3); add the prefill ORIGIN as a per-card "Registrar consumo" `NavLink` in existing `Formulas.jsx` → `/inventario/transaccion?formula_id={id}` — no new ficha route. `InventoryTransaction.jsx` reads it via React Router `useSearchParams` (v7 installed).

## Review Workload Forecast

| Slice | Est. changed lines | Tests |
|---|---|---|
| A | ~260 (220–300) | 5 |
| B | ~310 (280–350) | 5 |
| C | ~340 (310–370) | 7 |
| D | ~300 (270–320) | 4 |
| E | ~390 (350–430) | 4 |
| F1 | ~430 (395–465) | 4 |
| F2 | ~290 (260–320) | 3 |
| Total | ~2,320 | 32 |

**Slice F rule:** F aggregate ≈ 655–785 > 500 → **SPLIT F1 + F2 as two PRs (never a budget exception)**.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units (stacked PRs → main, order A→B→C→D→E→F1→F2)

| PR | Unit | Focused test cmd | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| A | Migration + enums + models | `pytest tests/test_migration.py` | pytest real SQLite/alembic | `alembic downgrade -1`; revert enums |
| B | Item CRUD + audits | `pytest tests/test_inventory.py` | pytest test client | unregister router, revert main.py |
| C | Atomic txn + notes policy | `pytest -k transaction tests/test_inventory.py` | pytest rollback proof | drop POST route; no stock path |
| D | History + alerts + status | `pytest -k "history or alert" tests/test_inventory.py` | pytest derived read | drop GET routes; status derived |
| E | Inventory list/form UI | `npm test -- src/pages/Inventory.test.jsx` | `npm run dev` `/inventario` | revert route+nav, delete page |
| F1 | Txn form + formula prefill | `npm test -- src/pages/InventoryTransaction.test.jsx` | `npm run dev` via Formulas card | revert Formulas link, delete page |
| F2 | Alerts grouped view | `npm test -- src/pages/InventoryAlerts.test.jsx` | `npm run dev` `/inventario/alertas` | revert route+nav, delete page |

## Phase A: Migration & Models (RED first)

- [x] A.1 RED: `test_migration.py` — `EXPECTED_TABLES` 8→10 (`inventory_items`, `inventory_transactions`); rename test to `all_ten_tables`
- [x] A.2 RED: `test_inventory.py` foundation — both tables post-`upgrade head`; downgrade drops only new
- [x] A.3 GREEN: `db/enums.py` — `ItemType`, `TransactionType` (str-Enum, `native_enum=False`, ADR-5)
- [x] A.4 GREEN: `inventory/models.py` — 2 ORM tables; ix `item_type`/`reorder_threshold`/`inventory_item_id`; nullable `formula_id` FK, `user_id` FK
- [x] A.5 GREEN: `alembic/versions/0003_inventory.py` (`down_revision="0002_samples"`, additive); `env.py` imports models (commit)

## Phase B: Item CRUD (RED first)

- [x] B.1 RED: create → 201 + ONE `access_logs` row; PATCH supplier/threshold audited (S3–4)
- [x] B.2 RED: 404 on missing; **PATCH with `current_stock` leaves stock unchanged (ADR-6, S4)**
- [x] B.3 RED: boundary — `current_stock == reorder_threshold` reads `ok`, `<` reads `bajo_umbral` (ADR-1)
- [x] B.4 GREEN: `inventory/schemas.py` — `ItemCreate/Update/Out` + computed `inventory_status`
- [x] B.5 GREEN: `router.py` CRUD (GET/POST/PATCH, audits `inventory.item.create/update`); register in `main.py` (commit)

## Phase C: Atomic Transactions (RED first)

- [x] C.1 RED: happy path — 201; txn row + `current_stock` delta + EXACTLY ONE audit (ADR-2, S6)
- [x] C.2 RED: rollback — monkeypatched `log_action` raise → no txn row, stock unchanged, no audit (S7)
- [x] C.3 RED: negative resulting w/o `notes` → 400 exact "las transacciones que dejan stock negativo requieren una nota" (S9)
- [x] C.4 RED: `ajuste` w/o `notes` → 400 (S10); negative w/ note → 201 (S8); in-stock w/o note → 201 (S11)
- [x] C.5 GREEN: `schemas.py` `TransactionIn/Out` (signed delta, ADR-6)
- [x] C.6 GREEN: service notes policy PRE-txn — 400 before any DB write (ADR-3)
- [x] C.7 GREEN: POST route — `promote_sample` pattern: add+flush → mutate stock → `log_action` → commit; `except: db.rollback()`; 404 missing item (commit)

## Phase D: History & Alerts (RED first)

- [x] D.1 RED: history newest-first with type, qty, `formula_id`, user, notes, ts (S13)
- [x] D.2 RED: alerts grouped by `supply_city`+`supplier` across 2 cities; empty list when none below (S14–15)
- [x] D.3 RED: status flip — consumo drops below threshold → same read returns `bajo_umbral`, no migration (S12, ADR-4)
- [x] D.4 GREEN: shared `derive_status(item)` (ADR-1)
- [x] D.5 GREEN: `GET /items/{id}/transactions` + `GET /reorder-alerts` (GROUP BY) (commit)

## Phase E: Inventory UI (RED first)

- [x] E.1 RED: `Inventory.test.jsx` — list renders items+status; form submits create (stubbed fetch)
- [x] E.2 GREEN: `api/index.js` item/txn helpers
- [x] E.3 GREEN: `Inventory.jsx` list+form (Formulas.jsx pattern)
- [x] E.4 GREEN: `/inventario` route in `AppRouter.jsx` + nav link in `Layout.jsx` (commit)

## Phase F1: Transaction Flow + Prefill (RED first)

- [x] F1.1 RED: `InventoryTransaction.test.jsx` — render; submit txn; **prefill `formula_id` from `?formula_id=` (MemoryRouter initialEntries)**; absent param → no formula
- [x] F1.2 GREEN: `api/index.js` — `registerInventoryTransaction`, `listInventoryTransactions`
- [x] F1.3 GREEN: `InventoryTransaction.jsx` mobile form (SampleRegistration pattern) + `useSearchParams` prefill
- [x] F1.4 GREEN: `Formulas.jsx` per-card "Registrar consumo" NavLink → `/inventario/transaccion?formula_id={id}` (commit)

## Phase F2: Alerts View (RED first)

- [x] F2.1 RED: `InventoryAlerts.test.jsx` — grouped render by city/supplier; empty state
- [x] F2.2 GREEN: `api/index.js` — `listReorderAlerts`
- [x] F2.3 GREEN: `InventoryAlerts.jsx` grouped view; `/inventario/alertas` route + nav link (commit)
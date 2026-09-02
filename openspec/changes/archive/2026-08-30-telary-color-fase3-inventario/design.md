# Design: Inventario y Trazabilidad (Fase 3)

## Technical Approach

New `inventory` module mirroring `samples`/`formulas`: ORM + Pydantic schemas + router in `backend/app/modules/inventory/`; `ItemType`/`TransactionType` added to `db/enums.py` (VARCHAR `native_enum=False`); additive handwritten `0003_inventory`. Every stock movement registers through ONE atomic endpoint (`POST /inventory/items/{id}/transactions`) that copies `promote_sample` (samples/router.py L188-232) verbatim: server-side FK check, `db.add`+`db.flush`, mutate `current_stock`, `log_action` in the SAME transaction, `except: db.rollback()` — never two requests. The notes policy is validated service-level BEFORE any DB write, so a 400 leaves zero residues. Derived `inventory_status` computed at read time, never stored. Frontend: `/inventario` list+form following `Formulas.jsx`; mobile txn flow + grouped alerts following `SampleRegistration.jsx`. Strict TDD RED→GREEN per slice; `test_migration.py` grows to 10 tables (slice A). Answers spec REQ 1–7 / 15 scenarios; access-logs and formulas untouched.

## Architecture Decisions

| # | ADR | Options | Tradeoff | Decision |
|---|---|---|---|---|
| 1 | Threshold comparison (**FIXED**) | (a) `current_stock >= reorder_threshold → ok`; `< → bajo_umbral` (b) strict `>` | (a) at-threshold reads ok — inclusive, "still sufficient" (b) at-threshold already alerts | **(a) — settled, NOT open to reinterpretation**; matches spec "At or above threshold reads ok"; one `derive_status(item)` shared by list/read/alerts |
| 2 | Stock movement atomicity | (a) two requests: POST txn + PATCH item (b) single atomic endpoint | (a) crash leaves orphan txn or desynced stock, split audit (b) one txn: insert+flush → mutate stock → log → commit | **(b)** — verbatim `promote_sample` pattern; spec "Atomic Stock Transaction" |
| 3 | Notes policy: service-level, pre-txn | (a) validate inside commit block (b) validate before any DB write | (a) policy mixed into txn; failure modes dirty the session (b) 400 decided before session writes begin | **(b)** — `ajuste` always requires non-empty `notes`; resulting `< 0` requires non-empty `notes` (400, exact message). Exception: `resulting = current_stock + quantity` is computed inside the same service call (read current → apply delta in memory), but the 400-vs-proceed decision happens BEFORE the mutation txn opens |
| 4 | Stock status | (a) stored column + recalc job (b) derived at read time | (a) drift, migration on flip (b) zero schema churn | **(b)** — computed `inventory_status` on read schemas; flips with no migration (spec "Binary Stock Status") |
| 5 | Enum storage | (a) SQLite native enum (b) str-Enum + VARCHAR `native_enum=False` | (a) unsupported/portable (b) matches `db/enums.py` | **(b)** — `ItemType(colorante, insumo_pasta_madre)`, `TransactionType(entrada, consumo, ajuste)` |
| 6 | Quantity semantics | (a) unsigned + direction field (b) signed delta | (a) two sources of truth (b) `current_stock += quantity`; `entrada` +, `consumo`/`ajuste` − | **(b)** — FASE3 convention; PATCH never touches `current_stock` (stock moves only via transactions → sum invariant) |

## Data Flow

(a) Atomic transaction — same detail level as Fase 2 promote:

```
POST /inventory/items/{id}/transactions {type, quantity, formula_id?, notes?}
  → get_current_user (ANY authenticated user)
  → SERVICE: db.get(item, id)                → 404 missing
  → SERVICE: resulting = item.current_stock + quantity   (in-memory)
  → SERVICE: notes policy — pre-txn (ADR-3):
      type == ajuste and notes empty   → 400 (nota obligatoria)
      resulting < 0 and notes empty    → 400 "las transacciones que dejan stock negativo requieren una nota"
  → begin txn:
      db.add(InventoryTransaction(...)); db.flush()  → txn.id
      item.current_stock = resulting
      log_action(db, user.id, "inventory.transaction") → ONE access_logs row
      db.commit()                                    → 201
  └─ any exception → db.rollback() → nothing persists → 400/500
```

(b) Reorder alerts read (brief):

```
GET /inventory/reorder-alerts
  → select items WHERE current_stock < reorder_threshold      (ADR-1)
  → group by supply_city, supplier                            (buy-route planning)
  → [{supply_city, supplier, items[]}] each item carries inventory_status="bajo_umbral"
  → [] when nothing below threshold
```

## File Changes

| File | Action | Slice | Description |
|---|---|---|---|
| `backend/app/db/enums.py` | Modify | A | `ItemType`, `TransactionType` |
| `backend/app/modules/inventory/{__init__,models,schemas,router}.py` | Create | A–D | ORM, schemas, CRUD + txn/history/alerts routes |
| `backend/alembic/versions/0003_inventory.py` | Create | A | Additive; `down_revision="0002_samples"`; 2 tables + indexes on `item_type`/`reorder_threshold`; downgrade drops only new |
| `backend/alembic/env.py` | Modify | A | `import app.modules.inventory.models` |
| `backend/tests/test_migration.py` | Modify | A | `EXPECTED_TABLES` + both tables (8→10), idempotent, downgrade-safe |
| `backend/tests/test_inventory.py` | Create | A–D | RED tests per slice |
| `backend/app/main.py` | Modify | B | `inventory_router` under `/api/v1` |
| `frontend/src/api/index.js` | Modify | E/F | item/txn/alerts helpers |
| `frontend/src/pages/Inventory.jsx` + `.test.jsx` | Create | E | list + form (Formulas.jsx pattern) |
| `frontend/src/pages/InventoryTransaction.jsx` + `.test.jsx` | Create | F1 | mobile txn form, `formula_id` prefill |
| `frontend/src/pages/InventoryAlerts.jsx` + `.test.jsx` | Create | F2 | grouped alerts view |
| `frontend/src/router/AppRouter.jsx`, `components/Layout.jsx` | Modify | E | `/inventario` route + nav link |

## Interfaces / Contracts

```python
# inventory_items: id, name, item_type ix, unit, supplier, supply_city,
#   current_stock, reorder_threshold ix, created_at, updated_at
# inventory_transactions: id, inventory_item_id FK(ix), transaction_type,
#   quantity signed delta, formula_id FK(formulas) NULL, user_id FK(users),
#   notes NULL, created_at

GET    /inventory/items                    → list, each + inventory_status
POST   /inventory/items                    → 201; audit inventory.item.create
GET    /inventory/items/{id}               → item + inventory_status
PATCH  /inventory/items/{id}               → never current_stock; audit inventory.item.update
POST   /inventory/items/{id}/transactions  → 201 atomic; audit inventory.transaction
GET    /inventory/items/{id}/transactions  → history newest-first (type, qty, formula_id, user, notes, ts)
GET    /inventory/reorder-alerts           → grouped by supply_city + supplier
```

`InventoryItemOut` adds computed `inventory_status: Literal["ok", "bajo_umbral"]` (ADR-1/4).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (backend) | ADR-1 boundary (`==` → ok, `<` → bajo_umbral); notes policy (ajuste w/o notes → 400; negative-resulting w/o notes → 400 exact message; in-stock consumo w/o notes → ok); signed-delta semantics | `test_inventory.py` |
| Integration | atomic happy path = txn row + stock delta + exactly ONE access_logs; rollback (monkeypatched `log_action` raise → no txn row, stock unchanged, no audit); history newest-first; alerts grouped across 2 cities + empty; CRUD audits; migration 10 tables + downgrade | `test_inventory.py`, `test_migration.py` |
| Unit (frontend) | list/form render + helpers; txn form prefills `formula_id`; alerts grouped render | vitest stubbed `fetch` (Search.test.jsx pattern) |

## Threat Matrix

N/A — no slot applies. Routing: routine `APIRouter` registration under the existing `/api/v1` prefix; the Fase 2 SPA/`/api/`/`/uploads` guard is untouched, so no new routing boundary. No shell/subprocess (the alembic subprocess in `test_migration.py` is pre-existing test infrastructure). No VCS/PR automation, executable-file classification, or process integration in this change.

## Migration / Rollout

`0003_inventory` additive: upgrade creates only the new tables + indexes; downgrade drops only them (proposal rollback). No feature flag, no data migration. `EXPECTED_TABLES` update is the slice-A RED step.

## Delivery / Planning

Chain A→F as chained PRs under the Fase 2 500-line per-attempt budget; work-unit commits, tests shipped with code. **Slice F structural split (never a budget exception):** **F1** = transaction flow + `formula_id` preload (`InventoryTransaction.jsx`, `registerInventoryTransaction`, `listInventoryTransactions`, prefill via `?formula_id=`); **F2** = grouped alerts view (`InventoryAlerts.jsx`, `listReorderAlerts`). `sdd-tasks` MUST plan F1 and F2 as two PRs within slice F whenever the forecast exceeds 500 changed lines.

## Open Questions

- None blocking.
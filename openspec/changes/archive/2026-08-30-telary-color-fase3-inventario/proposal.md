# Proposal: Inventario y Trazabilidad (Fase 3)

## Intent

The paint section has no visibility into remaining colorante/pasta-madre stock, per-production consumption, or when to buy, since supplies come from other cities with real delay. Adds an inventory module (items + transactions) with traceability and reorder alerts.

## Scope

### In Scope
- Tables `inventory_items` + `inventory_transactions`; additive `0003_inventory`; enums `ItemType`/`TransactionType`; indexes on `item_type`/`reorder_threshold`; nullable `formula_id` FK
- Atomic stock+transaction (`promote_sample` pattern), history endpoint, alerts by `supply_city`+`supplier`, `access_logs` audit
- Slices A–F strict TDD, chained PRs A→F; frontend list/form, mobile txn flow with `formula_id` preload, alert

### Business Rules
- **Negative stock ALLOWED, `notes` mandatory** — else 400 ("las transacciones que dejan stock negativo requieren una nota"); blocking would break physical-consumption trace
- **`ajuste` REQUIRES non-empty `notes`**
- **Binary alert `ok`/`bajo_umbral`** at read time vs `reorder_threshold`, never stored; `crítico` in Fase 4
- **All authenticated users** can register transactions; `access_logs` enables later role gating

### Out of Scope
- Supplier integration, consumption prediction, multi-warehouse, `crítico` alerts

## Capabilities

### New Capabilities
- `inventory`: items CRUD + binary status, transactional stock movement with traceability, history, reorder alerts by city/supplier

### Modified Capabilities
- None — `access-logs` generic; `formulas` unchanged (consumo links by FK)

## Approach

Mirror modules: `backend/app/modules/inventory/`, enums in `db/enums.py`. Copy `promote_sample` verbatim: server-side FK, `db.add`+`db.flush`, mutate `current_stock`, `log_action` in SAME txn, `try/except db.rollback()`, never two requests. Alerts: `GROUP BY` + computed status. UI: `Formulas.jsx`, `SampleRegistration.jsx`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/modules/inventory/` | New | models/schemas/router |
| `backend/app/db/enums.py` | Modified | `ItemType`, `TransactionType` |
| `backend/alembic/versions/0003_inventory.py` | New | 2 tables + indexes |
| `backend/tests/test_migration.py` | Modified | `EXPECTED_TABLES` + both tables (slice A) |
| `backend/tests/test_inventory.py` | New | CRUD/transactions/rollback/alerts |
| frontend (pages/router/api) | New/Mod | list/form, txn flow, alerts, route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `test_migration.py` breaks | High | `EXPECTED_TABLES` update = slice-A step (RED-first) |
| Stock/transaction desync | Med | promote atomic pattern; failure-path test asserts rollback |
| 6 slices > 400 lines | High | Chained PRs A→F; 500-line per-attempt limit (forecast) |
| Status drift | Med | derived at read time, never stored |

## Rollback Plan

Downgrade `0003_inventory` (drops only new tables/indexes/enums), unregister router, revert frontend. No Fase 1/2 data at risk.

## Dependencies

- Fase 1 baseline + Fase 2 promote pattern (main); `formulas.id` FK

## Success Criteria

- [ ] `current_stock` always equals transaction sum (no orphan/drift)
- [ ] Below-threshold items visible in seconds, by city/supplier
- [ ] Production consumo linked to `formula_id`; every txn in `access_logs`
- [ ] Negative-stock/`ajuste` without `notes` → 400; tests green per slice
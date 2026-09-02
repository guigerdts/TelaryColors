# Inventory Specification

## Purpose

Track colorante and pasta-madre stock with transaction traceability and reorder alerts, so the paint area knows what remains, what production consumed, and when to buy — supplies come from other cities with real delay.

## Requirements

### Requirement: Inventory Data Model

The system MUST persist `inventory_items` and `inventory_transactions` via additive migrations (`0003_inventory` plus the `0004_designs` additions), with enums `ItemType` (`colorante`, `insumo_pasta_madre`) and `TransactionType` (`entrada`, `consumo`, `ajuste`), indexes on `item_type` and `reorder_threshold`, a nullable `formula_id` FK to `formulas`, a nullable `design_id` FK to `designs`, and a `user_id` FK to `users`, plus `supplier`, `supply_city`, `current_stock`, `reorder_threshold`, `notes`.
(Previously: nullable `formula_id` only — no `design_id`.)

#### Scenario: Migration adds tables

- GIVEN a database at the 0003 baseline
- WHEN `alembic upgrade head` runs
- THEN both tables, enums, and indexes exist, plus the added `design_id` column

#### Scenario: Downgrade is additive-safe

- GIVEN the migrated database
- WHEN `alembic downgrade` runs
- THEN only the new table/columns drop; Fase 1/2/3 data stays intact

### Requirement: Inventory Item CRUD

The system MUST support create, read, and update (PATCH) of `inventory_items` — `name`, `item_type`, `unit`, `supplier`, `supply_city`, initial `current_stock`, `reorder_threshold`. Item creation MUST be audited in `access_logs`.

#### Scenario: Create item with threshold

- GIVEN an authenticated user
- WHEN an item is created with `current_stock` 10 and `reorder_threshold` 3
- THEN it persists with one audit event

#### Scenario: Update supplier or threshold

- GIVEN an existing item
- WHEN its `supplier` or `reorder_threshold` is PATCHed
- THEN the change persists and is audited

### Requirement: Binary Stock Status at Read Time

The derived status `ok`/`bajo_umbral` MUST be computed at read time from `current_stock` vs `reorder_threshold`, MUST NOT be stored in any column, and MUST change without any migration or recalc job.

#### Scenario: At or above threshold reads ok

- GIVEN an item with `current_stock` at or above `reorder_threshold`
- WHEN the item is listed or read
- THEN the derived status is `ok`

#### Scenario: Indicator flips without schema change

- GIVEN an item reading `ok` while `current_stock == reorder_threshold`
- WHEN a `consumo` drops `current_stock` below the threshold
- THEN the same read endpoint returns `bajo_umbral` — no migration or recalc job ran

### Requirement: Atomic Stock Transaction With Auto Design Link

Registering any transaction MUST insert the `inventory_transactions` row, update the item's `current_stock`, and write its `access_logs` event in one transaction — never two requests; any mid-operation failure MUST roll back entirely. When a `consumo` carries a `formula_id` AND a `design_id`, the same single transaction SHALL also upsert a `formula_designs` row with `source=auto` and audit it, without creating a duplicate pair when the `(formula_id, design_id)` pair already exists.
(Previously: atomic insert + stock update + audit with an optional `formula_id`, without any design link.)

#### Scenario: Happy-path consumo with formula

- GIVEN an authenticated user inside a formula's page
- WHEN a `consumo` is registered with the preloaded `formula_id`
- THEN the transaction row, the `current_stock` decrease, and one audit event persist atomically

#### Scenario: Automatic link from tagged consumption

- GIVEN an authenticated user registering a `consumo` with a valid `formula_id` and a valid `design_id`
- WHEN the transaction is committed
- THEN a `formula_designs` row persists with `source=auto` in the same transaction
- AND a `formula_design.create` audit event writes
- AND no duplicate pair is created when the same `(formula_id, design_id)` already exists

#### Scenario: Rollback on mid-operation failure

- GIVEN the audit write is monkeypatched to raise after `current_stock` was mutated
- WHEN the transaction is registered
- THEN nothing persists: no transaction row, `current_stock` unchanged, no `formula_designs` row, no audit event

### Requirement: Negative Stock and Notes Policy

A transaction that leaves `current_stock` negative MUST be allowed only with non-empty `notes`; otherwise the system MUST reject with 400 and message "las transacciones que dejan stock negativo requieren una nota". A transaction of type `ajuste` MUST always require non-empty `notes`, regardless of stock sign. Other transactions MAY omit notes.

#### Scenario: Negative consumo with note succeeds

- GIVEN a `consumo` that would leave `current_stock` negative
- WHEN it is registered with a note
- THEN it persists with 201/200 — negative stock is permitted, not rejected

#### Scenario: Negative consumo without note rejected

- GIVEN a `consumo` that would leave `current_stock` negative, with no note
- WHEN it is registered
- THEN 400 with message "las transacciones que dejan stock negativo requieren una nota", nothing persists

#### Scenario: Ajuste without notes rejected

- GIVEN an `ajuste` with empty `notes`
- WHEN it is registered
- THEN 400, nothing persists

#### Scenario: In-stock consumo without note allowed

- GIVEN a `consumo` keeping `current_stock` at or above zero
- WHEN it is registered without notes
- THEN it persists — notes are mandatory only in the negative-stock and `ajuste` cases

### Requirement: Transaction History

The system MUST expose a per-item history endpoint listing that item's transactions, newest-first, with type, quantity, `formula_id`, user, notes, timestamp.

#### Scenario: History newest-first

- GIVEN an item with several transactions
- WHEN its history is requested
- THEN all transactions return newest-first with full traceability fields

### Requirement: Reorder Alerts by City and Supplier

The system MUST list items whose derived status is `bajo_umbral`, grouped by `supply_city` and `supplier`, for buy-trip planning. Only `bajo_umbral` is in scope; `crítico` is deferred.

#### Scenario: Below-threshold items grouped

- GIVEN items below threshold across two cities
- WHEN alerts are requested
- THEN they return grouped by `supply_city` and `supplier`

#### Scenario: Nothing below threshold

- GIVEN all items at or above their thresholds
- WHEN alerts are requested
- THEN an empty list returns

### Requirement: Design Reference on Consumption Transactions

The system SHALL add a nullable `design_id` FK to `inventory_transactions` referencing `designs`, introduced in the additive `0004_designs` migration. The `design_id` SHALL be optional on any transaction and MAY be set when registering a `consumo` tied to a design. The existing transaction contract and `user_id`/`formula_id` behavior SHALL remain unchanged; omitting `design_id` MUST NOT affect legacy transactions.

#### Scenario: Consumption without design

- GIVEN an authenticated user registering a `consumo` with a `formula_id`
- WHEN they omit `design_id`
- THEN the transaction persists with `design_id` null
- AND no `formula_designs` link is created

#### Scenario: Downgrade is additive-safe

- GIVEN the migrated database with `design_id` present
- WHEN `alembic downgrade` runs
- THEN only the new table and columns drop; Fase 1/2/3 data stays intact

## Delivery Notes

- Slices A–F ship as chained PRs under the Fase 2 500-line per-attempt budget.
- Slice F directive: if `sdd-tasks` forecasts slice F above 500 changed lines, split it into two PRs within the same slice — F1 (transaction flow + `formula_id` preload) and F2 (alerts grouped view) — rather than requesting a budget exception.
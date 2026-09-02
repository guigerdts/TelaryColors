# Delta for inventory

## ADDED Requirements

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

## MODIFIED Requirements

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

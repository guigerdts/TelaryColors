# Delta for Base

## MODIFIED Requirements

### Requirement: Data Layer (SQLite + SQLAlchemy 2.0)

The system MUST use SQLite with SQLAlchemy 2.0 to persist all eight tables: `users`, `access_logs`, `pantone_colors`, `formulas`, `formula_ingredients`, `designs`, `design_colors`, `samples`.
(Previously: listed seven tables, without `samples`)

#### Scenario: Database available

- GIVEN a fresh backend
- WHEN it boots
- THEN the configured SQLite database is available for all modules

### Requirement: Single Initial Migration (Alembic)

The system MUST use Alembic. The base `0001_initial` migration creates the seven original tables; the additive `0002_samples` migration adds the `samples` table. Alembic MUST import all module metadata so no table is missing.
(Previously: a single initial migration creating all seven tables)

#### Scenario: Fresh upgrade

- GIVEN a clean database
- WHEN `alembic upgrade head` runs
- THEN all eight tables are created

#### Scenario: Already applied

- GIVEN the migrations already applied
- WHEN they run again
- THEN Alembic reports no pending changes

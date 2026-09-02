# Formula-Designs Specification

## Purpose

Track which designs use which formulas through a `formula_designs` join, populated both automatically (tagged consumption transactions) and manually (from the formula detail page), without ever duplicating a `(formula_id, design_id)` pair, and expose a rich formula detail endpoint that returns a formula with its linked designs deduplicated.

## Requirements

### Requirement: Formula-Design Link Data Model

The system MUST persist a `formula_designs` table via the additive `0004_designs` migration with `formula_id` FK to `formulas`, `design_id` FK to `designs`, a `source` enum restricted to `auto` or `manual`, and `created_at`. The table SHALL enforce `UNIQUE(formula_id, design_id)` so a pair never repeats at the data layer. The model SHALL sit alongside — not replace — the existing `design_colors` link.

#### Scenario: Migration creates table

- GIVEN a database at the 0003 baseline
- WHEN `alembic upgrade head` runs
- THEN `formula_designs` is created with the unique pair constraint beside `design_colors`

#### Scenario: Duplicate pair rejected at data layer

- GIVEN an attempt to insert a second row for an existing `(formula_id, design_id)`
- WHEN the insert runs
- THEN it fails a uniqueness violation rather than creating a duplicate row

### Requirement: Automatic Link (source=auto)

Registering a consumption transaction tagged with a valid `formula_id` and a valid `design_id` SHALL upsert a `formula_designs` row with `source=auto` in the same atomic transaction, creating the pair only if it does not already exist and leaving the existing row untouched otherwise.

#### Scenario: Automatic link from tagged consumption

- GIVEN a consumption transaction with `formula_id` and `design_id` both valid
- WHEN the transaction is registered
- THEN a `formula_designs` row upserts with `source=auto`
- AND no duplicate pair is created if the pair already exists

### Requirement: Manual Link (source=manual)

The system SHALL let an authenticated user link a design to a formula directly from the formula detail page, without any inventory transaction, persisting a `formula_designs` row with `source=manual`.

#### Scenario: Manual link from formula detail

- GIVEN an authenticated user on a formula's detail page
- WHEN they add an existing design without passing through an inventory transaction
- THEN a `formula_designs` row is created with `source=manual`
- AND a `formula_design.create` audit event writes

### Requirement: Duplicate Pair Handling (idempotent)

Linking an `(formula_id, design_id)` pair that already exists MUST NOT fail with a generic server error, whether the attempt is `auto` or `manual`. The system SHALL treat the link as idempotent: it returns the existing relation with the original `source` unchanged.

> Decision: idempotent return-the-existing is selected, because a user re-tagging a consumption or re-adding a design is not an error to surface. Alternative considered and documented: return `409 Conflict` when a manual link targets an existing pair; rejected to keep auto upsert and manual link consistent and non-frustrating.

#### Scenario: Re-link returns existing

- GIVEN a `(formula_id, design_id)` pair that already exists
- WHEN the same pair is linked again (auto or manual)
- THEN the call succeeds without a generic server error
- AND it returns the existing relation, preserving the original `source`

### Requirement: Formula Detail Endpoint (no duplicates)

The system SHALL expose `GET /api/v1/formulas/{id}/detail` returning the formula plus the list of its linked designs across both `auto` and `manual` sources, with the same design not appearing twice.

#### Scenario: Detail merges auto and manual without duplicates

- GIVEN a formula with designs linked by `auto` at one time and `manual` at another
- WHEN `GET /api/v1/formulas/{id}/detail` is requested
- THEN it returns the formula and a single list of designs
- AND a design linked by both sources appears exactly once

#### Scenario: Formula without designs

- GIVEN a formula with no linked designs
- WHEN `GET /api/v1/formulas/{id}/detail` is requested
- THEN it returns the formula with an empty designs list

### Requirement: Audit Propagation

Every `formula_design.create` (from `auto` or `manual`) SHALL be recorded in `access_logs`, consistent with Fases 1–3.

#### Scenario: Manual create audited

- GIVEN a user manually linking a design
- WHEN the link is created
- THEN an `access_logs` entry with `formula_design.create` records it

#### Scenario: Auto create audited

- GIVEN a tagged consumption creating a new pair
- WHEN the transaction commits
- THEN an `access_logs` entry with `formula_design.create` records it

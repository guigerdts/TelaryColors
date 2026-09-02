# Delta for designs

## ADDED Requirements

### Requirement: Client Field (optional)

The system SHALL add an optional `client` field to `designs` via an additive migration. `client` MUST be nullable and store the client name or design reference when provided. The existing create/update/list/delete behavior and `/designs` API SHALL remain unchanged; omitting `client` MUST NOT affect the current CRUD contract.

#### Scenario: Create design without client

- GIVEN an authenticated user creating a design
- WHEN they omit `client`
- THEN the design persists with `client` null
- AND no other design field is affected

#### Scenario: Create design with client

- GIVEN an authenticated user creating a design
- WHEN they set `client` to a client name
- THEN the design persists with that client name

### Requirement: Notes Field (optional)

The system SHALL add an optional `notes` field to `designs` via an additive migration. `notes` MUST be nullable and store free-text context about the design. The existing CRUD contract SHALL remain unchanged; omitting `notes` MUST NOT affect the current behavior.

#### Scenario: Create design without notes

- GIVEN an authenticated user creating a design
- WHEN they omit `notes`
- THEN the design persists with `notes` null

#### Scenario: Notes editable later

- GIVEN an existing design
- WHEN its `notes` are updated via PATCH
- THEN the change persists and is audited in `access_logs`

## MODIFIED Requirements

### Requirement: Design Fields

A design SHALL have a required, unique `name`; a `paint_type` that MUST be `reactiva` or `pigmento`; a `created_by` referencing the creating user; `created_at`; and `updated_at`. Optionally a design MAY carry nullable `client` and `notes`.
(Previously: required fields only — `client` and `notes` did not exist.)

#### Scenario: Create a design

- GIVEN an authenticated user
- WHEN they create a design with a name, a valid paint type, and 1–7 colors
- THEN the design is persisted with `created_by`, `created_at`, and `updated_at`

#### Scenario: Duplicate name

- GIVEN a design with a name that already exists
- WHEN created or updated
- THEN the system rejects it as a uniqueness conflict

#### Scenario: Invalid paint type

- GIVEN a design whose `paint_type` is neither `reactiva` nor `pigmento`
- WHEN created
- THEN the system rejects it with a validation error

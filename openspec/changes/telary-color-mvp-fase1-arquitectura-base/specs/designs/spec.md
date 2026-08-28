# Designs Specification

## Purpose

Client designs (diseños) — the product's core unit. A design has a name and paint type, and references between 1 and 7 Pantone colors, each produced using its formula.

## Requirements

### Requirement: Design Fields

A design SHALL have a required, unique `name`; a `paint_type` that MUST be `reactiva` or `pigmento`; a `created_by` referencing the creating user; `created_at`; and `updated_at`.

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

### Requirement: Color Cardinality (1–7)

A design SHALL reference between 1 and 7 distinct `pantone_colors`. The system SHALL reject a create/update with 0 colors or more than 7 colors (422/400 with a Spanish error message).

#### Scenario: No colors

- GIVEN a design with 0 referenced colors
- WHEN created or updated
- THEN the system rejects it with a 422/400 and a Spanish error message

#### Scenario: Too many colors

- GIVEN a design referencing 8 or more distinct colors
- WHEN created or updated
- THEN the system rejects it with a 422/400 and a Spanish error message

#### Scenario: Boundary accepted

- GIVEN a design referencing exactly 1 color
- WHEN created or updated
- THEN the design is accepted
- AND a design referencing exactly 7 colors is also accepted

### Requirement: No Duplicate Color References

A design MUST NOT contain duplicate `pantone_color` references; each color appears at most once per design.

#### Scenario: Duplicate color

- GIVEN a design referencing the same pantone color more than once
- WHEN created or updated
- THEN the system rejects it or collapses the duplicates to a single reference

### Requirement: Cascade Delete of Link Rows

Deleting a design SHALL cascade-delete its `design_colors` rows, and the delete SHALL be audited in `access_logs`.

#### Scenario: Delete design

- GIVEN a design with associated `design_colors` rows
- WHEN it is deleted
- THEN the design and its `design_colors` rows are removed
- AND an `access_logs` entry records the delete

### Requirement: Authenticated Access (admin or operator)

Authenticated users with role `admin` OR `operator` SHALL be able to create, list, update, and delete designs (plant-level work, not admin-only).

#### Scenario: Operator works with designs

- GIVEN an authenticated operator
- WHEN they create, list, update, or delete a design
- THEN the operation succeeds

#### Scenario: Unauthenticated request

- GIVEN an unauthenticated request
- WHEN it targets a design endpoint
- THEN the system returns 401

### Requirement: Audit All Design Mutations

Every design create, update, and delete SHALL be recorded in `access_logs`.

#### Scenario: Mutation logged

- GIVEN an authenticated user
- WHEN they create, update, or delete a design
- THEN an `access_logs` entry records the action

### Requirement: Minimal Designs Page (Frontend)

The frontend SHALL provide a minimal designs page (list, create/edit) with a name field, a `paint_type` selector, and a picker of 1–7 Pantone colors that disables adding an 8th color.

#### Scenario: UI enforces cardinality

- GIVEN a user on the designs page
- WHEN they add 7 colors
- THEN the UI disables adding an 8th color

---

## Design-Time Note: cardinality enforcement

SQLite cannot CHECK a row-count constraint across child rows (`design_colors`), so the 1–7 cardinality MUST be enforced at the application level inside a transaction (reject 0 and >7), and mirrored in the UI (disable the 8th color). The unique `(design_id, pantone_color_id)` pair on `design_colors` prevents duplicates at the data layer.

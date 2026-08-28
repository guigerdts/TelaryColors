# Pantone Colors Specification

## Purpose

CRUD and instant search of Pantone colors by code, with gamut and paint type classification, for the color-formula manager.

## Requirements

### Requirement: Pantone Color CRUD

The system MUST support create, read, update, and delete of `pantone_colors`. Each color MUST have a unique, indexed `code`.

#### Scenario: Full CRUD cycle

- GIVEN an authenticated user
- WHEN they create, read, update, or delete a pantone color
- THEN the operation succeeds and the color is persisted

#### Scenario: Duplicate code

- GIVEN an attempt to create or update a color with a duplicate `code`
- WHEN submitted
- THEN the system returns a conflict error (409) and does not persist the duplicate

### Requirement: Instant Search by Code

The system MUST support searching pantone colors by code via `?q=` using the indexed `code` column, returning matching results quickly.

#### Scenario: Matching results

- GIVEN colors exist in the database
- WHEN a user queries `GET /api/v1/pantone-colors?q=221`
- THEN the system returns matching colors whose code matches the query

#### Scenario: No matches

- GIVEN no matches for the query
- WHEN searched
- THEN the system returns an empty result set (not an error)

### Requirement: Gamut and Paint Type Classification

The system MUST record `gamut` (default `C`; other gamuts reserved for future phases) and `paint_type` with values `reactiva` or `pigmento`. Spanish UI text MUST be used in the frontend.

#### Scenario: Invalid paint type

- GIVEN a color being created
- WHEN `paint_type` is neither `reactiva` nor `pigmento`
- THEN the system rejects it with a validation error

#### Scenario: Default gamut

- GIVEN a color without an explicit gamut
- WHEN created
- THEN the gamut defaults to `C`

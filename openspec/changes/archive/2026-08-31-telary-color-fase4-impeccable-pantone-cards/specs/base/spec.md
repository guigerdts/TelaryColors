# Delta for base

## ADDED Requirements

### Requirement: Shared Theme with Brand Accent 281C

The system SHALL provide a shared frontend theme carrying the brand accent Pantone 281C as `#00205B`. The accent MAY be used for brand elements (accents, highlights, interactive states) and MUST NOT be used as a dominant full-screen background, avoiding the "all-dark-blue" anti-pattern.

#### Scenario: Accent token present

- GIVEN the shared theme
- WHEN the theme tokens are inspected
- THEN an `#00205B` accent token is defined for reuse across screens

#### Scenario: Accent not dominant

- GIVEN a screen using the shared theme
- WHEN the accent is applied
- THEN it appears as an accent, not as the dominant background

### Requirement: Impeccable Retrofit of Existing Screens

The system SHALL retrofit the existing Fase 1–3 screens (Formulas/Search, Inventory, InventoryTransaction, InventoryAlerts) guided by an Impeccable audit, addressing relevant findings or documenting them as out of scope. Low-risk passive layout/theme changes require no design-review ceremony beyond the ordinary test gate.

#### Scenario: Baseline audit recorded

- GIVEN the existing screens
- WHEN `/impeccable audit` runs
- THEN findings are recorded as a checklist and addressed or documented as out of scope

#### Scenario: Retrofit preserves behavior

- GIVEN a retrofitted screen
- WHEN its behavior is exercised
- THEN functionality is unchanged while visual quality improves

### Requirement: Strict TDD Applies to UI Retrofit

Any UI change introduced by the retrofit SHALL remain covered by the existing Vitest suite, following the strict TDD (red-green-refactor) standard. The backend test command is `pytest`; the frontend test command is `npm test`.

#### Scenario: Frontend red-green

- GIVEN a new frontend behavior in the retrofit
- WHEN implemented
- THEN a failing Vitest case is written first, then made green

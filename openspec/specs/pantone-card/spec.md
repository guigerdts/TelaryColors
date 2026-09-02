# Pantone-Card Specification

## Purpose

The PantoneCard is the central component of the app: it renders a Pantone as a solid color block with a PANTONE® wordmark, code+gamut, and HEX on a white strip, then shows the color formula in grams/kilo and the designs that use it, with an elevating hover effect. It consumes the rich formula detail endpoint.

## Requirements

### Requirement: Pantone Card Layout

The PantoneCard SHALL render a solid color block spanning the full card width at the top, followed by a white strip showing the "PANTONE®" wordmark, the code with its gamut type (e.g. `PMS 211 C`), and the HEX value. Below that, the card SHALL show the formula (list of colorants with their grams/kilo) and the designs/clients linked to that Pantone.

#### Scenario: Card renders core fields

- GIVEN a Pantone with code, gamut, HEX, a formula, and linked designs
- WHEN the card is rendered
- THEN the color block, PANTONE® wordmark, code+gamut, HEX, formula grams/kilo, and linked designs are all visible

#### Scenario: Card without designs

- GIVEN a Pantone with a formula but no linked designs
- WHEN the card is rendered
- THEN the formula shows and the designs section renders as empty rather than disappearing

### Requirement: Hover Elevation

The PantoneCard SHALL elevate on hover — a vertical translate together with a growing box-shadow via a transition — consistent with the system's other micro-interactions.

#### Scenario: Elevate on hover

- GIVEN a rendered PantoneCard
- WHEN the pointer hovers over it
- THEN the card translates up and its shadow grows with a smooth transition
- AND it returns to rest when the pointer leaves

### Requirement: Consume Formula Detail Endpoint

The PantoneCard SHALL load its data from `GET /api/v1/formulas/{id}/detail` in a single call, receiving the formula and its deduplicated linked designs together.

#### Scenario: Single-call load

- GIVEN a user viewing a formula's PantoneCard
- WHEN the card mounts
- THEN it fetches `GET /api/v1/formulas/{id}/detail`
- AND renders formula and deduplicated linked designs from that one response

### Requirement: Gamut Selector as Validated Options

The gamut selector in the Pantone create/search forms SHALL offer the real gamuts already in use — `C`, `TPX`, `U` — as selectable options, not free text. The system SHALL reject any gamut value outside `{C, TPX, U}` via backend and/or UI validation.

#### Scenario: Valid gamut accepted

- GIVEN a user creating or searching a Pantone
- WHEN they select one of `C`, `TPX`, or `U`
- THEN the value is accepted

#### Scenario: Out-of-range gamut rejected

- GIVEN a user creating or searching a Pantone
- WHEN they attempt to submit a gamut outside `{C, TPX, U}`
- THEN the system rejects it with a validation error (backend and/or UI)
- AND only the real options are permitted

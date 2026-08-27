# Formulas Specification

## Purpose

CRUD of color formulas with nested ingredients, decimal quantities, and automatic unit conversion.

## Requirements

### Requirement: Formula CRUD with Nested Ingredients

The system MUST support create, read, update, and delete of `formulas`, each with `name`/`notes`, `created_by`, `created_at`, and `updated_at`, and nested `formula_ingredients`. Deleting a formula MUST cascade-delete its ingredients.

#### Scenario: Create formula with ingredients

- GIVEN an authenticated user
- WHEN they create a formula with ingredients
- THEN the formula and its ingredients are persisted, recording `created_by`, `created_at`, and `updated_at`

#### Scenario: Cascade delete

- GIVEN a formula with ingredients
- WHEN it is deleted
- THEN the formula and all its ingredients are removed

### Requirement: Ingredient Fields

The system MUST record for each ingredient a `colorant`, a decimal `quantity` (e.g. `0.01`, `0.001`, `20`, `1`), and a `unit` with enum values `g` or `kg`.

#### Scenario: Invalid unit

- GIVEN an ingredient being created
- WHEN `unit` is neither `g` nor `kg`
- THEN the system rejects it with a validation error

#### Scenario: Invalid quantity

- GIVEN a non-numeric or invalid quantity
- WHEN an ingredient is created
- THEN the system rejects it with a validation error

### Requirement: Automatic Unit Conversion

The system MUST support automatic conversion between `g` and `kg` where `1000 g` equals `1 kg`. Input quantities MUST be stored as decimal without floating-point precision loss.

#### Scenario: Kilogram to grams

- GIVEN an ingredient with `1 kg`
- WHEN expressed in grams
- THEN it equals `1000 g`

#### Scenario: Sub-gram precision

- GIVEN an ingredient with `0.001 kg`
- WHEN expressed in grams
- THEN it equals `1 g`

### Requirement: Formula to Pantone Link

The system MUST allow a formula to reference a `pantone_color_id`.

#### Scenario: Valid reference

- GIVEN a pantone color that exists
- WHEN a formula is created referencing it
- THEN the formula is linked to that color

#### Scenario: Nonexistent reference

- GIVEN a formula referencing a nonexistent pantone color
- WHEN created
- THEN the system rejects it

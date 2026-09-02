# Delta for samples

## ADDED Requirements

### Requirement: Samples Screens Participate in Retrofit

The samples screens (list, create/edit, sample detail) SHALL participate in the Impeccable retrofit and SHALL consume the shared theme, including the brand accent 281C `#00205B` for interactive/brand elements. The retrofit MUST NOT alter sample behavior, status lifecycle, photo handling, or the atomic-promote contract.

#### Scenario: Sample screen styled by shared theme

- GIVEN a samples screen consuming the shared theme
- WHEN it is rendered
- THEN it uses the shared tokens, including the `#00205B` brand accent

#### Scenario: Retrofit preserves sample behavior

- GIVEN a retrofitted samples screen
- WHEN a user creates, edits, promotes, or reuses a sample
- THEN the existing workflows and contracts behave exactly as before, with visuals improved

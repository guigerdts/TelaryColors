# Samples Specification

## Purpose

CRUD of reusable color samples with an optional photo, a free audited status lifecycle, hardened photo upload/serving, and atomic promotion to a formula, so near-miss tones resurface when their target Pantone is searched.

## Requirements

### Requirement: Sample Data Model

The system MUST persist `samples` as the 8th domain table via an additive `0002_samples` migration — NOT NULL `pantone_target_id` FK, optional `formula_id` and `photo_url`, a `status`, `notes`, a `created_by` FK, `created_at` — with indexes on `pantone_target_id` and `status`.

#### Scenario: Migration adds table

- GIVEN a clean database
- WHEN `alembic upgrade head` runs
- THEN the `samples` table and indexes are added beside the originals

### Requirement: Sample CRUD with Optional Photo

The system MUST support create, read, and update (PATCH) of `samples`. A photo MUST be optional at creation and editable later. A sample MUST never be hard-deleted.

#### Scenario: Create without photo

- GIVEN an authenticated user
- WHEN a sample is created with no photo
- THEN it persists with null `photo_url`

#### Scenario: Photo added later

- GIVEN a sample created without a photo
- WHEN its `photo_url` is updated via PATCH
- THEN the change is persisted and audited

### Requirement: Free Audited Status Lifecycle

The system MUST allow free transitions among `aprobada`, `archivada_reutilizable`, and `descartada`. Every create and status change MUST be audited in `access_logs` in the same transaction.

#### Scenario: Audited transition

- GIVEN a sample in `archivada_reutilizable`
- WHEN it transitions to `descartada`
- THEN the status updates and one `access_logs` row writes in the same transaction

#### Scenario: Any direction

- GIVEN a sample in any of the three states
- WHEN it transitions to another state
- THEN it succeeds and is audited

### Requirement: Reusable Listing by Target Pantone

The system MUST support `GET /samples?pantone_target_id={id}&status=archivada_reutilizable`, returning up to the newest N=5 reusable samples, newest-first.

#### Scenario: Window capped

- GIVEN more than five reusable samples for one pantone
- WHEN listed
- THEN at most five are returned, newest-first

#### Scenario: Fewer than five

- GIVEN fewer than five reusable samples for a pantone
- WHEN listed
- THEN all return

### Requirement: Photo Upload Validation

At upload time the system MUST server-side validate file type and size, never trusting the client-declared content-type or extension alone. Only JPEG/PNG/WebP within a defined size limit MUST be accepted.

#### Scenario: Crafted type rejected

- GIVEN an upload whose bytes are JPEG but declare a different content-type
- WHEN uploaded
- THEN it is rejected, no file written

#### Scenario: Oversized file rejected

- GIVEN an upload exceeding the size limit
- WHEN uploaded
- THEN it is rejected, no file written

#### Scenario: Malicious filename rejected

- GIVEN an upload with a path-traversal filename
- WHEN uploaded
- THEN it is rejected; the stored name is server-generated

### Requirement: Photo Serving Hardening

The `/uploads` module MUST NOT allow directory listing, MUST serve only static files with no code execution, and MUST never shadow `/api/` routes.

#### Scenario: No directory listing

- GIVEN a request to the `/uploads` root or a directory
- WHEN fetched
- THEN no listing is returned

#### Scenario: API never shadowed

- GIVEN the app serving both `/api/` and `/uploads`
- WHEN both are requested
- THEN `/api/` stays reachable and `/uploads` serves stored files only

### Requirement: Atomic Promote

Promoting a sample MUST, in a single transaction, create the new formula and mark the sample `aprobada`, producing exactly one `access_logs` event. Any mid-way failure MUST roll back completely.

#### Scenario: Happy-path promote

- GIVEN an `archivada_reutilizable` sample
- WHEN it is promoted
- THEN a formula is created, the sample becomes `aprobada`, with exactly one `access_logs` event

#### Scenario: Rollback on failure

- GIVEN a promote whose formula creation fails
- WHEN it runs
- THEN nothing persists: no formula, no audit event, sample stays `archivada_reutilizable`

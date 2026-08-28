# Proposal: Muestras Reutilizables (Reusable Samples)

## Intent

During color approximation, physical/virtual samples are produced that never become the final formula but stay reusable. Today they are lost, so operators redo the approximation. This phase records every sample — photo, target Pantone, status — so past near-miss tones resurface when that Pantone is searched. Extends the archived Fase 1 baseline with the `samples` module.

## Scope

### In Scope
- `samples` module: 8th table, additive `0002_samples` migration, indexes on `pantone_target_id` + `status`
- Sample CRUD + free status transitions `aprobada` ↔ `archivada_reutilizable` ↔ `descartada`, all audited in `access_logs`
- Photo optional at creation, editable later; uploaded to local filesystem, served via `/uploads` (single-origin)
- Pantone ficha: official formula + latest N=5 reusable samples (client-side composition)
- Promote sample → new formula (`POST /formulas` + link; sample marked `aprobada`)
- Slices A–F, strict TDD RED→GREEN per slice; `test_migration.py` table set 7→8

### Out of Scope
- Automatic color recognition; advanced image compression; Fase 3 inventory
- Hard deletion — status-only lifecycle; audit trail is the only trace

## Capabilities

### New Capabilities
- `samples`: sample data model, CRUD, photo upload, free audited status lifecycle, reusable listing by target Pantone, promote-to-formula

### Modified Capabilities
- None — `pantone-colors`/`formulas` specs unchanged (client-side composition; promote reuses existing endpoints); `access-logs` spec already generic

## Approach

Mirror the `formulas` module: `backend/app/modules/samples/{models,schemas,router}.py`, `SampleStatus` in `db/enums.py`, additive migration. Audit every create/status-change via `access_logs.service.log_action()` in the same transaction. Upload: multipart → `upload_dir` (default `backend/data/uploads/`, gitignored) → relative `photo_url`; `/uploads` mount never shadows `/api/` (no cloud, ADR-2). Ficha = client-side composition: `GET /samples?pantone_target_id={id}&status=archivada_reutilizable`; promote via optional atomic `POST /samples/{id}/promote` or `POST /formulas` + `PATCH /samples/{id}`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/modules/samples/` | New | models/schemas/router |
| `backend/app/db/enums.py` | Modified | `SampleStatus` |
| `backend/alembic/versions/0002_samples.py` | New | 8th table + indexes |
| `backend/app/core/config.py` | Modified | `upload_dir` setting |
| `backend/app/main.py` | Modified | router + `/uploads` mount |
| `backend/tests/test_migration.py` | Modified | table set 7→8 |
| `backend/tests/test_samples.py` | New | CRUD/status/upload/promote |
| `frontend/src/pages/SampleRegistration.jsx` | New | mobile-first, ≤3 taps |
| `frontend/src/pages/Search.jsx`, `api/index.js` | Modified | ficha + promote |
| `frontend/src/router/AppRouter.jsx` | Modified | sample route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Upload serving arbitrary files | Med | content-type/size validation; mount guarded |
| `test_migration.py` breaks | High | RED-first: update with the migration |
| Ficha spec churn | Low | client-side composition; no pantone-colors delta |

## Rollback Plan

Downgrade `0002_samples` (additive — drops only the new table/indexes), unregister the router, unmount `/uploads`; frontend reverts to Fase-1 Search. No Fase-1 data at risk.

## Dependencies

- Fase 1 archived baseline (7 tables, access-logs, modules pattern) — in `main`
- `python-multipart` (already pinned) for multipart upload

## Success Criteria

- [ ] Sample registered from phone in ≤3 steps; photo optional and editable later
- [ ] Pantone search shows official formula AND up to 5 reusable samples
- [ ] Every create/status-change logged in `access_logs`
- [ ] All new pytest/vitest tests green per slice (strict TDD)

## Open Questions

- N on ficha: proposed 5, newest-first — finalize in design
- Promote: atomic endpoint vs. two-step client flow — settle in design
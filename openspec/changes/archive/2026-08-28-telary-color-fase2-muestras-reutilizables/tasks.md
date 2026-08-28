# Tasks: Muestras Reutilizables (Fase 2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR A → PR B → PR C → PR D → PR E → PR F (stacked to main) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| A | Data layer | PR A | `cd backend && pytest tests/test_migration.py` | `alembic upgrade head` on clean DB | revert `0002_samples`, `enums.py`, `env.py` import, `models.py` |
| B | Upload | PR B | `pytest tests/test_samples.py::test_upload_*` | `uvicorn app.main:app` + `curl -F` to `/uploads` | revert `uploads.py`, upload route, `config.py`, `main.py`, `vite.config.js` |
| C | Backend CRUD | PR C | `pytest tests/test_samples.py::test_crud_*` | curl live CRUD + listing flow | revert `schemas.py` + CRUD routes in `router.py` |
| D | Ficha integration | PR D | `npm test -- Search.test.jsx` | dev-server ficha composition scenario | revert `api/index.js` + `Search.jsx` |
| E | Frontend registration | PR E | `npm test -- SampleRegistration.test.jsx` | dev mobile form (≤3 taps) | revert `SampleRegistration` + `AppRouter/Layout` link |
| F | Ficha viz + promote | PR F | `pytest tests/test_samples.py::test_promote_*`; `npm test -- SampleFicha.test.jsx` | promote against live app | revert promote route + `SampleFicha.jsx` + `api` |

## Phase A: Data Layer

- [x] A1 RED `test_migration.py`: add `samples` to EXPECTED_TABLES (7→8; fresh upgrade + already-applied "Database available" scenarios)
- [x] A2 RED `test_samples.py`: `alembic upgrade head` creates `samples` + both indexes (S1 Migration adds table)
- [x] A3 GREEN `db/enums.py`: add `SampleStatus(aprobada, archivada_reutilizable, descartada)`
- [x] A4 GREEN `modules/samples/{__init__,models}.py`: `Sample` ORM (NOT NULL FK `pantone_target_id` ix, nullable `formula_id`/`photo_url`, `status` ix, `notes`, FK `created_by`, `created_at`)
- [x] A5 GREEN `alembic/env.py`: `import app.modules.samples.models`
- [x] A6 GREEN `alembic/versions/0002_samples.py`: additive (`down_revision="0001_initial"`), upgrade/downgrade, `ix_samples_pantone_target_id` + `ix_samples_status`

## Phase B: Photo Upload

- [x] B1 RED `test_samples.py`: crafted type (JPEG bytes claiming PNG) → 400, no file written (S8)
- [x] B2 RED `test_samples.py`: oversized → 413, no file written (S9)
- [x] B3 RED `test_samples.py`: `../../evil.png` filename → server-generated name inside `upload_dir` (S10)
- [x] B4 RED `test_samples.py`: `GET /uploads/`/directory → no listing (S11); `/api/` never shadowed (S12)
- [x] B5 GREEN `core/config.py` + `.env.example`: `upload_dir` (default `backend/data/uploads/`), `max_upload_bytes` (5 MiB)
- [x] B6 GREEN `modules/samples/uploads.py`: `_UploadsRoute` + helper (sniff JPEG `FF D8 FF`/PNG/WebP + declared agreement; `uuid4().hex` name)
- [x] B7 GREEN `modules/samples/router.py` + `main.py`: `POST /samples/upload` under `/api/v1`; register `_UploadsRoute` before `_mount_spa`; `_SPARoute.matches` yields `NONE` for `/uploads/`
- [x] B8 GREEN `frontend/vite.config.js`: dev proxy `/uploads` → `:8000`

## Phase C: Backend CRUD

- [x] C1 RED `test_samples.py`: create without photo → null `photo_url` (S2)
- [x] C2 RED `test_samples.py`: PATCH adds `photo_url` later → persisted + audited (S3)
- [x] C3 RED `test_samples.py`: `archivada_reutilizable`→`descartada` → one `access_logs` row same txn (S4)
- [x] C4 RED `test_samples.py`: any-direction transition succeeds + audited (S5)
- [x] C5 RED `test_samples.py`: listing >5 → ≤5 newest-first (S6)
- [x] C6 RED `test_samples.py`: listing <5 → all returned (S7)
- [x] C7 RED `test_samples.py`: DELETE → 405
- [x] C8 GREEN `schemas.py` + `router.py`: POST (default `archivada_reutilizable`), GET read, PATCH (`status`/`photo_url`/`notes` only; `pantone_target_id` immutable), GET list `?pantone_target_id=&status=` cap 5; audit `sample.create/update/status`; no DELETE route

## Phase D: Ficha Integration

- [x] D1 RED `api/client.test.js`: `listReusableSamples(id)` → `GET /samples?pantone_target_id=&status=archivada_reutilizable`
- [x] D2 GREEN `api/index.js`: add `listReusableSamples`
- [x] D3 GREEN `pages/Search.jsx`: fetch reusable samples per result; compose client-side ficha surface (no pantone-colors delta)

## Phase E: Frontend Registration

- [x] E1 RED `SampleRegistration.test.jsx`: ≤3 taps, photo optional, `capture="environment"`
- [x] E2 RED `api/client.test.js`: `uploadSamplePhoto` sends FormData, no JSON content-type
- [x] E3 GREEN `api/index.js`: `uploadSamplePhoto`, `createSample`, `updateSample`
- [x] E4 GREEN `pages/SampleRegistration.jsx`: mobile-first form (Pantone target → optional photo → status+save)
- [x] E5 GREEN `router/AppRouter.jsx` + `components/Layout.jsx`: `/muestras` route + nav link

## Phase F: Ficha Visualization + Promote

- [x] F1 RED `test_samples.py`: happy promote → formula + `aprobada` + `formula_id` + **exactly one** `access_logs` row (S13)
- [x] F2 RED `test_samples.py`: promote failure (empty ingredients) → rollback, sample unchanged (S14)
- [x] F3 RED `test_samples.py`: promote on non-`archivada_reutilizable` → 409; missing → 404
- [x] F4 GREEN `modules/samples/router.py`: `POST /samples/{id}/promote` atomic (derive `pantone_color_id` from sample; one txn + one audit row; 409/404)
- [x] F5 RED `SampleFicha.test.jsx`: render thumbnails + promote click calls `promoteSample`
- [x] F6 GREEN `api/index.js` + `components/SampleFicha.jsx` + `pages/Search.jsx`: `promoteSample`, component, wire promote action

## Notes

Strict TDD (RED first); `pytest` from `backend/`, `npm test` (vitest). Slices A–F stack to main (merge commits, no squash — Fase 1 parity).

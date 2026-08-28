## Exploration: Fase 2 — Muestras Reutilizables

### Current State

Fase 1 (MVP) is complete and archived. The codebase is a modular FastAPI + React monolith:

- **Backend** (`backend/app/`): `core/` (config, deps, security), `db/` (base, session, enums), and `modules/{auth,users,pantone_colors,formulas,designs,access_logs}/`. Each domain module owns `models.py` + `schemas.py` + `router.py` (SQLAlchemy 2.0 `Mapped` typed columns, Pydantic v2 schemas with `from_attributes`). Routers are registered in `main.py` under API_PREFIX `/api/v1`; the built SPA is served single-origin by `_mount_spa` from `frontend/dist` (no CORS, ADR-2).
- **Data layer**: one handwritten Alembic migration `0001_initial` creates the 7 domain tables (users, access_logs, pantone_colors, formulas, formula_ingredients, designs, design_colors). Enums are Python `Enum` subclasses stored as VARCHAR (`sa.Enum(..., native_enum=False)`), shared in `app/db/enums.py` (`PaintType`, `Unit`). Timestamps are naive-UTC via `app/db/base.py:utcnow` (ADR-8). FKs are enforced via `PRAGMA foreign_keys=ON` (session.py).
- **Audit pattern**: `app/modules/access_logs/service.py:log_action(db, user_id, action)` queues a row in the same transaction the router commits (`db.flush()` → `log_action()` → `db.commit()`). Read-only GET requests never log. The `access-logs` spec is generic ("every data-mutating action across managed resources"), so a new `samples` module inherits audit coverage **without modifying** that spec.
- **Pantone detail / search (Slice D target)**: `GET /pantone-colors/{id}` returns only the color fields (`PantoneColorOut`). There is **no dedicated "ficha"/detail page** in the frontend — `Search.jsx` renders a color's official formula inline by client-side filtering the full `listFormulas()` result on `pantone_color_id`. Slice D/F will need to attach reusable samples to this surface.
- **Frontend**: `src/{api,components,pages,router,auth,hooks}`. `api/index.js` holds endpoint helpers over the relative `api/client.js` (`apiFetch`, Bearer token, 401 → clear + redirect). Routes in `AppRouter.jsx` (protected: Search, Pantone, Formulas, Designs, Usuarios). Tailwind. PWA, mobile-first intent (plant use on phone).
- **Testing**: backend pytest per module (`backend/tests/test_*.py`) on temp-file SQLite with `client`/`auth_headers`/`session_factory` fixtures (`conftest.py`), run from `backend/` with `.venv`; `test_migration.py` asserts the migration builds the exact table set. Frontend vitest, `fileParallelism:false` (single aarch64 box), `npm test`. Strict TDD = RED first, all new tests green before merge.
- **`.gitignore`**: `backend/data/` and `frontend/dist/` are ignored. There is currently **no** upload/photo mechanism and no `/uploads` static mount.

### Affected Areas

- `backend/app/modules/samples/` (NEW) — `models.py`, `schemas.py`, `router.py` for `samples` CRUD + status change + list-by-pantone + filter reusable (mirrors formulas module).
- `backend/app/db/enums.py` — add `SampleStatus` enum (`aprobada`/`archivada_reutilizable`/`descartada`), following `PaintType`/`Unit` pattern.
- `backend/app/main.py` — register `samples_router` under `/api/v1`; add an `/uploads` static mount (or extend `_SPARoute`) to serve stored sample photos.
- `backend/app/core/config.py` — add an upload-dir setting (e.g. `upload_dir`) so photo storage root is configurable, mirroring `database_url`.
- `backend/alembic/versions/0002_samples.py` (NEW) — additive migration adding the `samples` table + indexes on `pantone_target_id` and `status` (8th domain table).
- `backend/app/modules/pantone_colors/router.py` + `schemas.py` — Slice D: extend `GET /pantone-colors/{id}` response to include reusable samples (and/or the official formula), or compose from a new samples list endpoint.
- `backend/app/modules/formulas/` — "promote sample to formula" creates a `Formula`; reuses existing formula create; may need a helper/endpoint to also set `sample.formula_id`.
- `backend/tests/test_samples.py` (NEW), `test_migration.py` (update expected tables to 8), `test_pantone_colors.py` (Slice D response) — backend tests.
- `frontend/src/pages/SampleRegistration.jsx` (NEW, Slice E) — mobile-first sample registration form (pantone target, photo upload, notes, status).
- `frontend/src/pages/Search.jsx` + `api/index.js` (Slice F) — render "Muestras relacionadas" thumbnails + promote-to-formula on the color ficha; add `samples` + photo-upload API helpers.
- `frontend/src/router/AppRouter.jsx` — add route(s) to the sample flow (or extend the Search surface).
- `frontend/src/**/*.test.*` — new vitest suites (api client upload, form, related-samples render).

### Approaches

1. **Samples data layer + CRUD (Slice A + C, backend delta)** —
   New `samples` module following formulas. `samples(id, pantone_target_id FK→pantone_colors NOT NULL, formula_id FK→formulas NULL, photo_url, status SampleStatus, notes, created_by FK→users, created_at)`, DB indexes on `pantone_target_id` + `status`. Endpoints: `POST /samples`, `GET /samples?pantone_target_id=`, `GET /samples/reusable?pantone_target_id=`, `PATCH /samples/{id}` (status change), logging `sample.create`/`sample.update`/`sample.status` via `log_action`. Operators admitted (plant use), like formulas/designs.
   - Pros: follows the established modular pattern exactly; reuses audit + FK/status conventions; low risk.
   - Cons: new migration + module (largest slice).
   - Effort: Medium.

2. **Photo upload to local filesystem (Slice B)** —
   `POST /samples/upload` (multipart) → validate content type (jpeg/png/webp) + size limit → write to `backend/data/uploads/{uuid}.{ext}` (or configured `upload_dir`) → return `photo_url` like `/uploads/{filename}`. Serve via a new static mount `/uploads` in `create_app` alongside `_mount_spa`; keep relative URL for single-origin (ADR-2, no CORS). `backend/data/` already gitignored.
   - Sub-option (a) reuse `backend/data/` (already ignored, co-located with DB) vs (b) dedicated `backend/uploads/` (+ gitignore entry).
   - Pros: no cloud dep (matches phase non-official); small, self-contained; relative URL keeps single-origin.
   - Cons: needs a static mount + config; no image optimization (explicitly out of scope).
   - Effort: Medium.

3. **Attach reusable samples to the Pantone detail (Slice D)** —
   Two viable shapes:
   - (a) **Extend the detail response**: `GET /pantone-colors/{id}` returns `{...color, formula: ...|null, samples: [...reusable]}`. Pros: one round-trip, ficha complete. Cons: tightens pantone_colors↔samples coupling and the formulas query lives in another module (cross-module import or service call).
   - (b) **Separate list endpoint composed client-side** (current Search approach): add `GET /samples?pantone_target_id={id}&status=archivada_reutilizable`, and the frontend ficha assembles formula + samples. Pros: keeps modules decoupled, matches existing `Search.jsx` composition pattern. Cons: extra request; response not atomic in one payload.
   - Effort: Low–Medium.

4. **Promote sample to formula (Slice F tail)** —
   A frontend action that calls existing `POST /formulas` with `pantone_color_id = sample.pantone_target_id` (+ ingredients), then `PATCH /samples/{id}` to set `formula_id`. Optionally provide a dedicated `POST /samples/{id}/promote` that wraps both in one transaction plus a `sample.promote` audit row.
   - Pros: reuses formula CRUD and audit; the dedicated endpoint keeps it atomic.
   - Cons: promote endpoint adds a small bespoke route.
   - Effort: Low–Medium.

### Recommendation

Build a new `samples` module (Approach 1) exactly mirroring the formulas module — models/schemas/router, `SampleStatus` enum in `db/enums.py`, additive `0002_samples` Alembic migration with indexes on `pantone_target_id` and `status`, and `log_action` on every create/status-change. Add local-filesystem photo upload (Approach 2, reusing the already-ignored `backend/data/` tree with an `upload_dir` setting and an `/uploads` static mount that keeps relative single-origin URLs). For the Pantone ficha (Slice D/F), prefer **Approach 3(b)** — a separate `GET /samples?pantone_target_id={id}&status=archivada_reutilizable` composed client-side — because it preserves module decoupling and matches the existing `Search.jsx` composition pattern; a small `PantoneFicha` component on the Search surface renders the official formula plus the "Muestras relacionadas" thumbnails. Promote-to-formula reuses `POST /formulas` + `PATCH /samples/{id}` with an optional atomic `POST /samples/{id}/promote`.

### Risks

- **No existing upload mechanism**: photo handling, static `/uploads` mount, and multipart handling (`python-multipart` — note Fase-1 already pins it for OAuth2 form) are new surface; validate content-type/size to avoid serving arbitrary files.
- **`samples` is the 8th table**: `test_migration.py` asserts an exact 7-table set — it MUST be updated together with the new migration or CI fails (RED-first will surface this).
- **Single-origin photo serving**: uploaded files must be served by the same FastAPI origin (ADR-2). Serving user files via StaticFiles needs a dedicated mount that does not shadow `/api/` (reuse the `_SPARoute` guard pattern or a narrower mount).
- **Slice D changes an existing endpoint/response — a Fase-1 archived spec**: if the detail response is extended (3a), it is a MODIFIED delta on the pantone-colors spec; if composed client-side (3b), only a new `samples` spec is needed (lower spec churn).
- **Strict TDD scope**: every RED test (backend pytest, frontend vitest) must be green before each PR merges, mirroring Fase 1's per-slice discipline.

### Ready for Proposal
Yes. The orchestrator should tell the user: a new `samples` module (8th table, `0002_samples` migration), local-filesystem photo upload with an `/uploads` static mount, samples CRUD + status change with audit reuse, and reusable samples attached to the Pantone ficha (composed client-side) with promote-to-formula. Slices A–F map cleanly to the existing modular + Strict TDD conventions.

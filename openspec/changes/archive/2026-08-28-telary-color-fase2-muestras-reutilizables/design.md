# Design: Muestras Reutilizables

## Technical Approach

New `samples` module mirroring `formulas`: ORM + Pydantic schemas + router, `SampleStatus` in `db/enums.py`, additive handwritten migration `0002_samples`. Local-filesystem photo upload with magic-byte validation, served by a guarded `/uploads` static mount. Promote = dedicated atomic endpoint (`POST /samples/{id}/promote`). Ficha composed client-side: `Search.jsx` already filters `listFormulas()` by `pantone_color_id`; it now additionally fetches reusable samples. Strict TDD RED→GREEN per slice; `test_migration.py` updated with the migration (slice A).

Base delta validated: 7 existing tables + `samples` = 8; `0002_samples` additive, `down_revision="0001_initial"`; MODIFIED "Data Layer" + "Single Initial Migration" are correct and complete. Impact: `test_migration.py` `EXPECTED_TABLES` + `samples`; test name/docstring 7→8.

## Architecture Decisions

| # | ADR | Options | Tradeoff | Decision |
|---|---|---|---|---|
| 1 | Uploads storage | (a) cloud (S3) (b) local FS | (a) external dep, credentials, CORS — violates ADR-2 single-origin (b) zero deps, gitignored `backend/data/` | **Local FS** — `upload_dir` (default `backend/data/uploads/`, already gitignored), configurable via `UPLOAD_DIR` |
| 2 | `/uploads` mount | (a) plain `Mount("/uploads")` (b) guarded route | (a) registration-order dependent (b) explicit `Match.NONE` for `/uploads/` | **Guarded static mount**: `_UploadsRoute` registered BEFORE `_mount_spa`; `_SPARoute.matches` extended to yield `NONE` for `/uploads/` — neither tree can shadow the other, order-independent |
| 3 | File validation | (a) trust declared content-type/extension (b) magic-byte sniffing only (c) sniff + declared agreement | (a) trivially spoofed (b) ignores client metadata but allows type smuggling (c) both must match | **Sniff + declared agreement** — JPEG `FF D8 FF`, PNG `89 50 4E 47...`, WebP `RIFF....WEBP`; declared type must be in `{image/jpeg, image/png, image/webp}` AND match sniffed type; size ≤ `MAX_UPLOAD_BYTES` (default 5 MiB); server-generated `{uuid4().hex}.{ext}` from sniffed type (never client filename) |
| 4 | Promote atomicity | (a) two-step client (`POST /formulas` + `PATCH /samples`) (b) `POST /samples/{id}/promote` | (a) non-atomic — crash leaves orphan formula, no audit coherence (b) one transaction: create formula → `db.flush()` → set `aprobada` + `formula_id` → `log_action("sample.promote")` → `commit`; `except: db.rollback()` | **Atomic endpoint** (spec REQ "Atomic Promote"); `pantone_color_id` derived from `sample.pantone_target_id` (never client-supplied); 409 if status ≠ `archivada_reutilizable` |
| 5 | Ficha composition | (a) extend `GET /pantone-colors/{id}` (b) client-side `GET /samples?...` | (a) cross-module coupling, pantone-colors delta (b) matches existing Search composition, zero spec churn | **Client-side** (spec/exploration approach 3b) — no pantone-colors delta |
| 6 | Lifecycle | field mutability / default status | — | `pantone_target_id` immutable post-create (anchors listing); PATCH scope: `status`, `photo_url`, `notes`; default status `archivada_reutilizable` (register = near-miss); audit `sample.create` / `sample.update` / `sample.status` / `sample.promote`; no DELETE route (405) |

## Data Flow

(a) Upload — validate → write → URL:

```
POST /samples/upload (multipart file)
  → size check (MAX_UPLOAD_BYTES, 413 if over)
  → declared content-type ∈ allowlist (415)
  → magic-byte sniff (400 mismatch / not-image; spec "Crafted type rejected")
  → filename = uuid4().hex + ext(sniffed type)      [spec "Malicious filename rejected"]
  → write upload_dir/{name} (fail → 500, nothing)
  → 201 {photo_url: "/uploads/{name}"}               [single-origin, ADR-2]
```

(b) Atomic promote — one transaction, one audit row:

```
POST /samples/{id}/promote {name, notes, ingredients}
  → db.get(Sample, id)                 → 404 missing
  → status == archivada_reutilizable?  → 409 otherwise
  → Formula(pantone_color_id=sample.pantone_target_id, ...)
  → db.add + db.flush()                → "formula_id"
  → sample.status = aprobada; sample.formula_id = formula.id
  → log_action("sample.promote")       → exactly ONE access_logs row
  → db.commit()                        → 201 {formula, sample}
  └─ any exception → db.rollback()     → nothing persists (spec "Rollback on failure")
```

(c) Ficha — client composition:

```
Search.jsx renders color
  → listFormulas() filter pantone_color_id        (existing)
  → listReusableSamples(id): GET /samples?pantone_target_id={id}&status=archivada_reutilizable
  → SampleFicha: img(photo_url) + "Promover" → promoteSample(id, {name, ingredients})
```

## File Changes

| File | Action | Slice | Description |
|---|---|---|---|
| `backend/app/db/enums.py` | Modify | A | `SampleStatus(aprobada, archivada_reutilizable, descartada)` |
| `backend/app/modules/samples/{__init__,models,schemas,router,uploads}.py` | Create | A/B/C | ORM, schemas, CRUD+upload+promote routes, upload helper |
| `backend/alembic/versions/0002_samples.py` | Create | A | Additive: `samples` table + `ix_samples_pantone_target_id` + `ix_samples_status`; downgrade drops both |
| `backend/alembic/env.py` | Modify | A | `import app.modules.samples.models` |
| `backend/app/core/config.py` + `.env.example` | Modify | B | `upload_dir`, `max_upload_bytes` |
| `backend/app/main.py` | Modify | B | `samples_router` under `/api/v1`; `_UploadsRoute` + `_SPARoute` guard |
| `backend/tests/test_migration.py` | Modify | A | `EXPECTED_TABLES` + `samples` (7→8) |
| `backend/tests/test_samples.py` | Create | A–F | CRUD/status/upload/promote/audit RED tests |
| `frontend/src/api/index.js` | Modify | D/F | `uploadSamplePhoto` (FormData, no JSON CT), `createSample`, `listReusableSamples`, `updateSample`, `promoteSample` |
| `frontend/src/components/SampleFicha.jsx` + `.test.jsx` | Create | F | related-samples thumbnails + promote form |
| `frontend/src/pages/Search.jsx` | Modify | D | render `<SampleFicha>` per result |
| `frontend/src/pages/SampleRegistration.jsx` + `.test.jsx` | Create | E | mobile-first: Pantone target → photo (optional, `capture="environment"`) → status+save (≤3 taps) |
| `frontend/src/router/AppRouter.jsx`, `components/Layout.jsx` | Modify | E | `/muestras` route + nav link |
| `frontend/vite.config.js` | Modify | B | dev proxy `/uploads` → `:8000` |

## Interfaces / Contracts

```python
class SampleStatus(str, Enum): aprobada="aprobada"; archivada_reutilizable="archivada_reutilizable"; descartada="descartada"

# samples: id, pantone_target_id FK(pantone_colors) NOT NULL ix,
#          formula_id FK(formulas) NULL, photo_url NULL, status ix,
#          notes NULL, created_by FK(users), created_at

GET    /samples?pantone_target_id=&status=   → newest-first; cap 5 when status=archivada_reutilizable AND target given
POST   /samples                              → 201 (status defaults archivada_reutilizable)
PATCH  /samples/{id}                         → status/photo_url/notes only
POST   /samples/upload                       → multipart → {photo_url}
POST   /samples/{id}/promote                 → 201 {formula, sample}; 404/409; atomic
# NO DELETE — 405
```

`SampleOut`: id, pantone_target_id, formula_id, photo_url, status, notes, created_by, created_at.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (backend) | upload validator: sniff/declared agreement, size cap, traversal filename | `test_samples.py` — crafted type (JPEG bytes claiming PNG → 400), oversized → 413, no file written |
| Integration | CRUD + audit rows in same transaction; status transitions each logged; reusable listing cap 5 newest-first + fewer-than-5; no DELETE → 405 | `test_samples.py` + `test_migration.py` (8 tables, idempotent) |
| Integration | promote: happy path = formula + `aprobada` + `formula_id` + exactly ONE access_logs row; failure (422 empty ingredients) → rollback: no formula, no audit row, sample unchanged | `test_samples.py` |
| Unit (frontend) | `uploadSamplePhoto` sends FormData w/o JSON CT; SampleRegistration ≤3 taps; SampleFicha render + promote call | vitest with stubbed `fetch` (Search.test.jsx pattern) |

## Threat Matrix

Routing/static-file boundary applies (mount order, upload classification); no shell/subprocess/VCS.

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Upload bytes served as executable/code | **Applicable** | sniff-only allowlist (JPEG/PNG/WebP); never HTML/SVG/scripts; `StaticFiles(html=False)`; no directory listing | upload `.svg`/`.html` bytes → 400; `GET /uploads/` → no listing |
| Filename/path injection | **Applicable** | client filename never used; `uuid4().hex` + sniffed ext | `../../evil.png` filename → 200 with server-generated name, file inside upload_dir |
| Git repo selection / commit / push / PR | N/A — no VCS automation in this change | — | — |
| Shell/subprocess | N/A — no shell-out (`file`/ImageMagick); pure Python sniffing | — | — |

Safe: `/api/` never shadowed (both mounts yield `NONE` for foreign prefixes); failure: non-image/oversized → 4xx, nothing written.

## Migration / Rollout

`0002_samples` additive: upgrade creates table+indexes only; downgrade drops only them (proposal rollback). No feature flag; both mounts co-exist with SPA from first boot (mount skipped only if dist missing, same as today). No data migration.

## Open Questions

- None blocking. (Orphan files when an upload is never referenced by a sample — accepted, gc out of scope.)
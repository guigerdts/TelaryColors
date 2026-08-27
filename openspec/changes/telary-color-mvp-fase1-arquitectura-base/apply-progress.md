# Apply Progress — Telary Color MVP Fase 1 (Slice A: Foundation)

Change: crear la arquitectura base de Telary Color MVP Fase 1
Slice: A (tasks 1.1–1.5) — PR A, chained stacked-to-main
Branch: `feat/slice-a-foundation` (base: `main` @ 383d471)
Date: 2026-08-27
Mode: **Strict TDD** (pytest backend / vitest frontend)

## Completed Tasks

- [x] 1.1 RED: boot test — `python -m uvicorn` serves `/docs` (PATH stub skipped).
- [x] 1.2 GREEN: `backend/requirements.txt` pinned (fastapi, uvicorn, python-multipart, sqlalchemy, alembic, bcrypt, PyJWT, pydantic-settings) + venv.
- [x] 1.3 GREEN: `app/{__init__,main}.py`, `core/{config,security,deps}.py`, `db/{base,session}.py` — WAL, foreign_keys ON.
- [x] 1.4 GREEN: `frontend/` Vite+React+Tailwind+vitest; `/api`→`:8000` proxy; `src/{api,components,pages,router,auth,hooks}`.
- [x] 1.5 GREEN: PWA manifest+icons (no SW); `.env.example`; README.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `backend/tests/test_boot.py` | Integration | N/A (new) | ✅ Written — 3 collection errors (`ModuleNotFoundError: No module named 'app'`) | ✅ 9/9 passed after app scaffold | ✅ 3 cases (/docs, /openapi.json, app title) | ✅ Clean |
| 1.2 | — (env infra; verified via `python -c "import fastapi, uvicorn, multipart, sqlalchemy, alembic, bcrypt, jwt, pydantic_settings"`) | Unit (import probe) | N/A (new) | ✅ RED observed: global env lacked the pinned deps (python-multipart missing globally — design key learning #4) | ✅ all imports ok in venv | ➖ Single (env install, no branchable logic) | ➖ None needed |
| 1.3 | `backend/tests/test_db.py`, `backend/tests/test_config.py` | Unit + Integration | N/A (new) | ✅ Written — same collection errors | ✅ 9/9 passed | ✅ 4 db cases (FK pragma, WAL pragma, session lifecycle, factory binding) + 2 config cases (defaults, env override) | ✅ One test-side fix: `Session.is_active` stays True after close() in SQLAlchemy 2.0; asserted real observable (checkout/checkin pool events) instead |
| 1.4 | `frontend/src/App.test.jsx` | Unit (component) | N/A (new) | ✅ Written — test file failed: `./App.jsx` missing | ✅ 1/1 passed | ➖ Single (placeholder shell, one rendered output — "Triangulation skipped: purely structural placeholder") | ➖ None needed |
| 1.5 | — (static assets: manifest + icons; verified via build output check) | N/A | N/A (new) | ➖ N/A — static asset, no behavior | ✅ manifest parses, 2 icons in dist, no sw.js/registration in bundle | ➖ N/A — static asset (Triangulation skipped) | ➖ None needed |

## Work Unit Evidence (Slice A)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Backend: `.venv/bin/python -m pytest tests/ -q` → **9 passed** in 2.66s. Frontend: `npm test` → **1 passed (1 file)**. Build: `npm run build` → **✓ built in 616ms** (16 modules). |
| Runtime harness command/scenario and exact result | `backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8101` → server starts, `GET /docs` → **200**, `GET /openapi.json` → `info.title == "Telary Color API"`. Confirms the documented boot path (never the PATH `uvicorn` Termux stub). |
| Rollback boundary | Revert the 5 slice commits on `feat/slice-a-foundation` (`git revert main..HEAD` or drop branch); `backend/data/` was NOT created (no DB in this slice). Frontend rollback = remove `frontend/` files. No unrelated work is touched. |

## Files Changed (PR A)

| File | Action | What Was Done |
|------|--------|---------------|
| `.gitignore` | Created | venv, .env, backend/data/, node_modules, dist, tooling caches |
| `backend/requirements.txt` | Created | 10 pinned deps (fastapi 0.141.1, uvicorn 0.52.4, python-multipart 0.0.32, sqlalchemy 2.0.52, alembic 1.19.1, bcrypt 5.0.0, PyJWT 2.13.0, pydantic-settings 2.15.0, pytest 9.1.1, httpx 0.28.1) |
| `backend/app/__init__.py` | Created | package marker + `__version__` |
| `backend/app/main.py` | Created | `create_app()` factory (+ module-level `app` for uvicorn) |
| `backend/app/core/config.py` | Created | pydantic-settings `Settings` (app_name, database_url, env_file `.env`) |
| `backend/app/core/security.py` | Created | placeholder docstring — implemented in auth slice (Phase 3) |
| `backend/app/core/deps.py` | Created | `get_db` re-export; auth deps (get_current_user/require_roles) land in Phase 3 |
| `backend/app/db/base.py` | Created | `Base(DeclarativeBase)` |
| `backend/app/db/session.py` | Created | engine factory w/ WAL + FK pragmas, session factory, `get_db` |
| `backend/tests/test_boot.py`, `test_db.py`, `test_config.py` | Created | 9 tests (boot, pragmas, session lifecycle, config) |
| `backend/pytest.ini`, `backend/.env.example` | Created | pytest pythonpath; environment template |
| `frontend/package.json`, `package-lock.json` | Created | React 19.2.8, Vite 8.2.2, Tailwind 4.3.3, vitest 4.1.11 (+testing-library) |
| `frontend/vite.config.js` | Created | react + tailwind plugins; `/api` → `:8000` proxy; vitest jsdom |
| `frontend/index.html` | Created | `lang="es"`, manifest + icon links, theme-color |
| `frontend/src/{main.jsx,App.jsx,index.css,App.test.jsx,test-setup.js}` | Created | app shell (Telary Color heading) + RED-to-GREEN vitest test |
| `frontend/src/{api,components,pages,router,auth,hooks}/index.js` | Created | placeholder modules (feature code in PR F) |
| `frontend/public/manifest.webmanifest` + `icons/icon-{192,512}.png` | Created | PWA install manifest + generated icons, NO service worker (HTTPS constraint) |
| `README.md` | Rewritten | LAN run instructions (venv boot, dev/build, tests, PWA note) |

## Commits (conventional, work units, no AI attribution)

| Hash | Commit |
|------|--------|
| `995fbe8` | chore(backend): pin backend dependencies |
| `8841e1d` | feat(backend): scaffold FastAPI app core with boot tests |
| `16b7eeb` | feat(frontend): scaffold Vite React Tailwind app |
| `1406fe6` | feat(frontend): add PWA manifest and icons |
| `706df2d` | docs: add LAN run instructions |

## Deviations from Design

- `get_db` lives in `app/db/session.py` and is re-exported from `core/deps.py` (design table lists `get_db` under both `db/base.py` and `core/deps.py`; single implementation in the session module avoids circular imports). `db/base.py` holds only `Base`.
- `core/security.py` and the auth half of `core/deps.py` are placeholders (docstring / TODO note) instead of implementations — they require the users module, which belongs to the auth slice (Phase 3); the design itself defers these there.
- Backend test command pinned via `pytest.ini` `pythonpath = .` (pytest ≥ 7) instead of a `conftest.py` at backend root. Behavior equivalent, fewer files.

## Issues Found

- **Git index corruption (environment, resolved)**: staged `.openclaw/**` + `.gga` entries with missing blobs broke tree builds (`invalid object ... for '.openclaw/skills/_shared/SKILL.md'`). Recovered with `git reset` before each commit and by staging only slice paths. These files remain untracked. Successor batches should expect the same pollution and use the same reset→stage→commit pattern.
- **`Session.is_active` semantics (test-side, resolved)**: stays `True` after `session.close()` under SQLAlchemy 2.0; the session-lifecycle test asserts the real observable (pool checkout/checkin) instead.
- **Slice line budget**: authored diff is 474+/3− (477 total, package-lock.json excluded as generated). Slightly over the nominal 400 line budget; slice A is the smallest autonomous unit of tasks.md Unit A (env+scaffold+PWA+docs) and cannot be split further without breaking autonomy. Flagging for the parent: accept PR A at ~477 authored lines (low-complexity boilerplate: configs, manifest, README) or record `size:exception`.

## Verification Environment

- Python 3.13.7 venv at `backend/.venv` (gitignored) — created and fully installed
- Node v22.23.1 / npm 10.9.8; `frontend/node_modules` installed (gitignored)
- PATH `uvicorn` stub confirmed broken by design (never invoked)

## Next Steps

- PR B (data layer): models, alembic env.py + 0001_initial, seed (tasks 2.1–2.4). `backend/data/` does not exist yet — create with migration.
- Verify phase for slice A: re-run `pytest`, `npm test`, `npm run build`, boot → `/docs`.
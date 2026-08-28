# Tasks: Telary Color MVP Fase 1 — Base Architecture

## Review Workload Forecast

- Estimated changed lines: ~2000–2500 (greenfield)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Suggested split: PR A → B → C → D → E → F

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal / PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| A | Env + scaffold + PWA + docs (PR A) | `python -c "import fastapi"`, `npm run build` | venv `python -m uvicorn` | revert scaffold |
| B | Models + migration + seed (PR B) | `pytest tests/test_migration.py tests/test_seed.py` | `alembic upgrade head` fresh DB | revert + rm `data/app.db` |
| C | Auth + users (PR C) | `pytest tests/test_auth.py tests/test_users.py` | `/docs` → login → `/auth/me` | revert routers |
| D | Pantone + formulas (PR D) | `pytest tests/test_pantone_colors.py tests/test_formulas.py` | curl `?q=` + formula POST | revert routers |
| E | Designs + audit + serve (PR E) | `pytest tests/test_designs.py tests/test_access_logs.py` | curl design (1–7 colors) | revert routers |
| F | Frontend screens (PR F) | `npm test` | `npm run dev` browser | revert `frontend/src` |

RED = failing test first (acceptance); GREEN = implementation. `pytest` backend / `npm test` frontend.

## Phase 1: Foundation

- [x] 1.1 RED: boot test — `python -m uvicorn` serves `/docs` (PATH stub skipped).
- [x] 1.2 GREEN: `backend/requirements.txt` pinned (fastapi, uvicorn, python-multipart, sqlalchemy, alembic, bcrypt, PyJWT, pydantic-settings) + venv.
- [x] 1.3 GREEN: `app/{__init__,main}.py`, `core/{config,security,deps}.py`, `db/{base,session}.py` — WAL, foreign_keys ON.
- [x] 1.4 GREEN: `frontend/` Vite+React+Tailwind+vitest; `/api`→`:8000` proxy; `src/{api,components,pages,router,auth,hooks}`.
- [x] 1.5 GREEN: PWA manifest+icons (no SW); `.env.example`; README.

## Phase 2: Data Layer

- [x] 2.1 RED: `test_migration.py` — upgrade head → 7 tables; rerun clean.
- [x] 2.2 GREEN: `modules/*/models.py` (7 tables, NUMERIC, UTC, cascade, unique pairs); alembic env.py, `0001_initial`.
- [x] 2.3 RED: `test_seed.py` — seed twice → 1 admin, unchanged data.
- [x] 2.4 GREEN: `app/seed.py` idempotent; env creds, fallback admin.

## Phase 3: Auth

- [x] 3.1 RED: `test_auth.py` — login 200 (audit, last_access), bad pwd 401, >72B 422, me 200/401, require_roles 403.
- [x] 3.2 GREEN: `security.py` (bcrypt direct, JWT 12h), `deps.py`, `auth/router.py`; no CORS.

## Phase 4: Users

- [x] 4.1 RED: `test_users.py` — admin CRUD ok, operator 403, unauth 401, bad role 422.
- [x] 4.2 GREEN: `users/{models,schemas,router}.py`; require_roles('admin'); audit.

## Phase 5: Pantone

- [x] 5.1 RED: `test_pantone_colors.py` — CRUD, dup 409, `?q=` prefix + empty 200, type 422, gamut 'C'.
- [x] 5.2 GREEN: `pantone_colors/{models,schemas,router}.py`, code unique+indexed, audit.

## Phase 6: Formulas

- [x] 6.1 RED: `test_formulas.py` — nested ingredients, cascade, unit/qty 422, missing pantone, kg→g (0.001 = 1 g).
- [x] 6.2 GREEN: `formulas/{models,schemas,router}.py` — `quantity_g` single conversion; audit.

## Phase 7: Designs

- [x] 7.1 RED: `test_designs.py` — admin+operator CRUD, dup name 409, 0/8 colors 422 (ES msg), 1 & 7 ok, dup color, cascade+audit.
- [x] 7.2 GREEN: `designs/{models,schemas,router}.py` — 1–7 cardinality in tx; unique pair FK.

## Phase 8: Audit + Wiring

- [x] 8.1 RED: `test_access_logs.py` — mutations + login logged, reads not, history stable.
- [x] 8.2 GREEN: `access_logs/service.py` in routers; `main.py` mounts API + static dist.

## Phase 9: Frontend

- [ ] 9.1 RED (vitest): Bearer attach + 401 clears token; store persists token; guard redirects.
- [ ] 9.2 RED (vitest): search debounce renders; picker disables 8th.
- [ ] 9.3 GREEN: `src/api`, auth store, guards, pages Login/Search/Pantone/Formulas/Designs/Admin (ES UI).

## Phase 10: Verify + Docs

- [ ] 10.1 `pytest` + `npm test` green; boot → `/docs`; login→search→create on LAN.
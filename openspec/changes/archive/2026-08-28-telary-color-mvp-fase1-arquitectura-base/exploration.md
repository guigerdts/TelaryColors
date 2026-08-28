# Exploration: Telary Color MVP Fase 1 — Base Architecture

## Current State

Greenfield repository. `git ls-files` shows only `README.md`; the authoritative product definition lives in untracked docs:
- `IMPLEMENTACION.md` — full product spec + proposed data model + phase plan (Fase 1–4)
- `SOUL.md` / `AGENTS.md` — agent persona and orchestrator conventions
- `openspec/config.yaml` — created by `sdd-init` (2026-08-27): strict TDD enabled, openspec persistence, modular-monolith convention, `pytest` + `npm test` runners
- `.codegraph/` — indexed but empty (0 nodes, consistent with greenfield)
- No application code, no `requirements.txt`, no `package.json`, no tests anywhere.

Product core (from `IMPLEMENTACION.md`): Telary Color is a color-formula manager for Telary Home's paint area. Today formulas live in decaying paper notebooks (>20 years old). **Fase 1 MVP scope**: login + last-access audit, Pantone color CRUD + formulas, instant search by Pantone code. Modules must grow independently (users, formulas, samples, inventory) — architecture must not be rewritten in Fase 4.

## Environment Reality (this dev box)

Host is **Termux PRoot Ubuntu 25.10, aarch64** — a dev/agent box, not the paint-area LAN PC. Verified globally installed:

| Tool | Version | Notes |
|---|---|---|
| Python | 3.13.7 | `pip 25.1.1` |
| fastapi | 0.139.0 | global |
| pydantic | 2.13.4 | global (v2) |
| SQLAlchemy | 2.0.51 | global |
| alembic | 1.18.4 | global |
| bcrypt | 4.2.0 | global |
| PyJWT | 2.10.1 | global |
| httpx | 0.28.1 | global (TestClient) |
| pytest / pytest-asyncio / pytest-cov / pytest-mock | 9.1.1 / 1.4.0 / 7.1.0 / 3.15.1 | global |
| pydantic-settings | 2.14.2 | global |
| Node / npm | 22.23.1 / 10.9.8 | registry reachable (PONG 683 ms) |
| sqlite3 CLI | 3.53.3 | available |

**Must be pinned by the project (NOT available globally):**
- **uvicorn** — not installed as a pip package. A stale Termux binary at `/data/data/com.termux/files/usr/bin/uvicorn` is in PATH but fails to execute under PRoot. Use `python -m uvicorn` from a project venv.
- **python-multipart** — required for FastAPI `OAuth2PasswordRequestForm` (form login). Missing.
- **passlib** — missing, and its maintenance status is a reason to avoid it (broken with bcrypt 4.x). Use `bcrypt` directly.
- **ruff** — declared available by `sdd-init`; not in global pip list; pin `ruff` in dev requirements or confirm lazily at apply time.
- Frontend toolchain (vite, vitest, tailwind, react, react-router) — none global; pin locally in `package.json`. `sdd-init` observed `vitest 4.1.11` via npx.

**Runtime implication**: everything must run from a project-local venv (`backend/.venv`) and node_modules; do NOT rely on global packages or a `uvicorn` shell command.

## Approaches

### A. Backend layout — three options

1. **Flat `app/` (single package, routers in one file)**
   - Pros: least files, fastest scaffold
   - Cons: violates the independent-modules requirement in IMPLEMENTACION.md §9 and openspec config; Fase 2–4 land as accretion
   - Effort: Low — rejected (does not meet stated requirement)

2. **Modular monolith (recommended)** — `app/` with `core/`, `db/`, and `app/modules/{auth,users,pantone_colors,formulas}/`, each module owning `router.py` + `schemas.py` + `models.py`
   - Pros: matches IMPLEMENTACION.md §5/§9 exactly; each module can grow or be disabled independently; Alembic imports metadata from all modules; fits SQLite/LAN simplicity
   - Cons: slightly more ceremony than Option 1
   - Effort: Medium

3. **Screaming/hexagonal modules (domain/service/repository per module)**
   - Pros: strongest decoupling, testability
   - Cons: overkill for MVP; IMPLEMENTACION.md §9 explicitly says prioritize simplicity and delivery speed
   - Effort: High — rejected for Fase 1

### B. Frontend layout

1. **Single-origin production (recommended)** — FastAPI serves `frontend/dist` statically on port 8000; Vite dev server proxies `/api` → `:8000`. No CORS anywhere; one LAN URL (`http://<pc-ip>:8000`).
2. **Separate servers + CORS** — Vite/nginx on :5173, API on :8000. More moving parts, CORS config, no benefit for a single-PC LAN deployment.

### C. Auth

1. **PyJWT + bcrypt direct (recommended)** — HS256 access token (exp ~12 h), `bcrypt.hashpw/checkpw` in a small `security.py` wrapper, `OAuth2PasswordBearer` + DI (`get_db`, `get_current_user`, `require_roles`). Modern, few deps.
2. **passlib + python-jose** — legacy pairing; passlib is unmaintained and incompatible with bcrypt 4.x; python-jose is dormant. Rejected.

### D. Data model phasing

| Table | Fase 1? | Notes |
|---|---|---|
| `users` | Yes | id, username (unique), full_name, password_hash, role, last_access_at, created_at |
| `access_logs` | Yes | id, user_id FK, timestamp, action; audit every data-mutating action + login |
| `pantone_colors` | Yes | id, code (unique, indexed — instant search), gamut ('C'), paint_type (reactiva/pigmento), created_at |
| `formulas` | Yes | id, pantone_color_id FK, name, notes, created_by FK, created_at, updated_at |
| `formula_ingredients` | Yes | id, formula_id FK (cascade), colorant, quantity, unit |
| `samples` / `inventory_items` / `inventory_transactions` | **No** | Fase 2 / Fase 3 |

Recommendation: English snake_case identifiers (`full_name`, `password_hash`, `last_access_at`, `code`, `gamut`, `paint_type`) mapped from the Spanish field names in IMPLEMENTACION.md; Spanish only in UI copy. Foreign keys: `users.id` → `pantone_colors`/`formulas` creators; login also writes `access_logs(action='login')`.

## Recommendation

**Modular monolith** backend (`backend/app/{core,db,modules/*}`), single-origin frontend served by FastAPI, PyJWT + bcrypt auth with DI, 5 tables in Fase 1, initial Alembic migration from module metadata, project-local venv + node_modules, strict TDD first (pytest RED on auth/colors/formulas/audit; vitest RED on api client/login/search/guard). Two backend roles for Fase 1: `admin` (user management) and `operator` (colors/formulas read-write).

## Proposed Surface (for the proposal phase to detail)

- **API** (prefix `api/v1/`, Swagger at `/docs`): `POST /auth/login`, `GET /auth/me`; `GET|POST /users` (admin); `GET /pantone-colors` (+`?q=` prefix search, case-insensitive, indexed), `POST|GET /{id}|PATCH|DELETE`; `POST /formulas`, `GET /formulas/{id}`, `PATCH`, `DELETE` (ingredients nested in the formula payload — one form, one save, MVP-simple); `GET /health`.
- **Entry points**: backend `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`; frontend `npm run dev` (dev) / `npm run build` → served by FastAPI at `/` (prod on LAN). `SECRET_KEY`, `DATABASE_URL` via `.env` (pydantic-settings, `.env.example` committed).
- **SQLite**: `backend/data/app.db`, gitignored; Alembic `0001_initial_schema` (autogenerate from module models, `upgrade head` as deploy step) + `python -m app.seed` bootstrap admin.
- **First TDD tests (backend)**: login ok/401, `/auth/me` 401/200, pantone create + `?q=` search match, formula create with nested ingredients, audit rows on login+create, operator denied `POST /users` (403). **First TDD tests (frontend)**: api client attaches `Authorization`, login submit stores token, search debounce renders results, ProtectedRoute redirect.

## Risks / Gaps

1. **PWA over LAN HTTP**: service workers and `beforeinstallprompt` require HTTPS or localhost — unavailable when the phone hits `http://192.168.x.x:8000`. Recommend Fase 1 = manifest + icons (+ optional theme color) so "Add to home screen" works on Android as a shortcut, defer offline/SW caching to a later phase (or until HTTPS is configured). Must be an explicit scope decision.
2. **uvicorn broken in PATH** (Termux binary) — always `python -m uvicorn` from the venv; pin `uvicorn` in requirements.
3. **`python-multipart` missing** — required for the OAuth2 form-login endpoint; must be pinned.
4. **bcrypt 4.x 72-byte limit** — validate password max length (e.g. 72) at schema level to avoid silent truncation surprises; use bcrypt directly, not passlib.
5. **Ingredient units underspecified** — `unidad` is free text in the doc; proposal must decide: free text with suggestions (gr/ml/gotas) vs strict enum. Recommend free text with suggestions.
6. **Seed data** — no Pantone seed source defined; manual entry + optional local CSV a realistic Fase 1 scope. Importing Pantone's official data may have licensing constraints — avoid for MVP.
7. **Language of identifiers** — IMPLEMENTACION.md lists Spanish columns; recommend English snake_case code identifiers (Spanish UI). Needs explicit confirmation.
8. **Deployment target unknown** — the PC will run Linux or Windows; keep everything cross-platform (python + node), no shell-only scripts.
9. **aarch64 PRoot box** — vitest/esbuild ship linux-arm64 prebuilds; low risk, but builds run on this box must pin exact versions to stay reproducible.
10. **Token lifetime / roles** — assume 12 h single access token and two roles (admin/operator); refresh tokens and granular roles are Fase 4 per IMPLEMENTACION.md.

## Ready for Proposal

**Yes.** The exploration found no blockers. Before `sdd-propose` runs, the orchestrator should ask the proposal-question round: (1) identifier language (English snake_case vs Spanish); (2) PWA Fase 1 scope (manifest-only vs full offline SW); (3) ingredient units (free text+suggestions vs enum); (4) user management in Fase 1 (admin API + seed vs minimal admin UI page too); (5) API versioning prefix (`/api/v1/` vs `/api/`).
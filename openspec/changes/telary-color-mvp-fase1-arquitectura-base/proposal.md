# Proposal: Telary Color MVP Fase 1 — Base Architecture

## Intent
Greenfield Fase 1 base: replace 20+ year-old paper notebooks with a LAN app — JWT login + audit, Pantone CRUD, formulas, designs, instant search; modular so Fase 4 needs no rewrite.

## Current State
Docs only; no code, deps, tests. Zero executable system; this change delivers the working skeleton end-to-end.

## Scope

### In Scope
- Backend modular monolith `backend/app/{core,db,modules}` (auth, users, pantone_colors, formulas, designs)
- SQLite + SQLAlchemy 2.0 + Alembic migration; idempotent seed admin
- JWT auth (PyJWT HS256, bcrypt direct, NOT passlib) + `access_logs` audit
- REST `/api/v1/`: login/me, users (admin), pantone-colors CRUD + `?q=`, formulas with nested ingredients, designs CRUD (1–7 Pantone colors)
- Frontend React+Vite+Tailwind: routing, auth guard, search screen, admin users page, designs page; PWA manifest+icons only; single-origin (FastAPI serves `frontend/dist`)
- TDD (pytest, vitest); `.env.example`; LAN run: `python -m uvicorn app.main:app` from venv (PATH uvicorn broken)

### Out of Scope
samples/inventory (Fase 2–3), offline SW, multi-gamut, extra roles, cloud/paid, native mobile, Pantone licensing import.

## Capabilities
New: `auth`, `users`, `pantone-colors`, `formulas`, `designs`, `access-logs`. Modified: none

## Approach
Modular monolith (IMPLEMENTACION.md §9): each module owns router/schemas/models; Alembic imports all metadata for one initial migration; auth via DI (`get_db`, `get_current_user`, `require_roles`); English snake_case code, Spanish UI; g/kg auto-converted (1000 g = 1 kg).

## Data Model
- `users`: id, username (unique), full_name, password_hash, role, last_access_at, created_at
- `access_logs`: id, user_id FK, timestamp, action
- `pantone_colors`: id, code (unique, indexed), gamut, paint_type, created_at
- `formulas`: id, pantone_color_id FK, name, notes, created_by FK, created_at, updated_at
- `formula_ingredients`: id, formula_id FK (cascade), colorant, quantity (decimal), unit (g|kg)
- `designs`: id, name (unique), paint_type (reactiva|pigmento), created_by FK, created_at, updated_at
- `design_colors`: id, design_id FK (cascade), pantone_color_id FK, unique pair (M2M design ↔ pantone_colors; 1–7 per design, enforced app-level)

## Key Decisions
PyJWT+bcrypt direct, not passlib (broken w/ bcrypt 4.x); 72-byte password cap; python-multipart pinned; admin/operator roles, 12 h token; units g/kg, auto conversion; seed admin only.

## Affected Areas
All New: `backend/app/**`, `frontend/**`, `backend/data/app.db` (gitignored), `openspec/specs/**`.

## Risks & Rollback
- Broken PATH uvicorn (High): `python -m uvicorn` from venv
- Missing python-multipart (High): pin in requirements
- bcrypt 72-byte truncation (Med): schema validation
- PWA needs HTTPS (High): manifest-only Fase 1

Rollback: per-layer scaffold-only commits; Alembic additive-only; idempotent seed; revert = `git revert` + delete regenerable `backend/data/app.db`.

## Dependencies
Python 3.13 venv: fastapi, sqlalchemy, alembic, bcrypt, PyJWT, pydantic-settings, python-multipart, uvicorn, pytest, httpx, ruff. Node: vite, vitest, react, react-router, tailwind.

## Open Questions
None blocking; seed-admin credentials env vs default.

## Success Criteria
- [ ] pytest: login ok/401, me 401/200, pantone CRUD+search, formula w/ nested ingredients, design 1–7 colors + dup/0/>7 rejected, audit rows, operator 403 on POST /users
- [ ] npm test: auth header, token store, search render, guard redirect, designs picker
- [ ] uvicorn boots; /docs loads; login → search → create formula/design on LAN
- [ ] Alembic upgrade head creates all 7 tables; seed idempotent
# Base Architecture Specification

## Purpose

Cross-cutting infrastructure: the data layer, schema management, single-origin deployment, PWA shell, and run/test entry points that all capability modules share.

## Requirements

### Requirement: Data Layer (SQLite + SQLAlchemy 2.0)

The system MUST use SQLite with SQLAlchemy 2.0 to persist all seven tables: `users`, `access_logs`, `pantone_colors`, `formulas`, `formula_ingredients`, `designs`, `design_colors`.

#### Scenario: Database available

- GIVEN a fresh backend
- WHEN it boots
- THEN the configured SQLite database is available for all modules

### Requirement: Single Initial Migration (Alembic)

The system MUST use Alembic with a single initial migration that creates all seven tables. Alembic MUST import all module metadata so no table is missing.

#### Scenario: Fresh upgrade

- GIVEN a clean database
- WHEN `alembic upgrade head` runs
- THEN all seven tables are created

#### Scenario: Already applied

- GIVEN the migration already applied
- WHEN it runs again
- THEN Alembic reports no pending changes

### Requirement: Application Entry Point

The system MUST boot via `python -m uvicorn app.main:app` run from the backend venv (the `uvicorn` PATH executable is unavailable).

#### Scenario: Boot from venv

- GIVEN the backend venv is activated
- WHEN `python -m uvicorn app.main:app` runs
- THEN the FastAPI app serves, `/docs` (Swagger) loads, and the API is reachable on the LAN

### Requirement: Single-Origin Deployment

The system MUST serve the built frontend from FastAPI so frontend and API share one origin, and MUST NOT enable CORS.

#### Scenario: SPA served from same origin

- GIVEN `frontend/dist` is built
- WHEN served by FastAPI
- THEN the SPA loads from the same origin as the API without CORS

### Requirement: PWA Shell (manifest + icons only)

The frontend MUST include a web app manifest and icons so it can be installed, and MUST NOT implement offline service-worker caching in Fase 1.

#### Scenario: Installable manifest

- GIVEN a built frontend
- WHEN inspected
- THEN a manifest and icons are present for installability

#### Scenario: No offline caching

- GIVEN a browser request for offline operation
- WHEN no service worker is registered
- THEN the app continues to require a network connection

### Requirement: Strict TDD

Backend behavior MUST be covered by pytest and frontend behavior by Vitest, following strict TDD (red-green-refactor). The backend test command is `pytest`; the frontend test command is `npm test`.

#### Scenario: Backend red-green

- GIVEN a new backend behavior
- WHEN implemented
- THEN a failing pytest case is written first, then made green

#### Scenario: Frontend red-green

- GIVEN a new frontend behavior
- WHEN implemented
- THEN a failing Vitest case is written first, then made green

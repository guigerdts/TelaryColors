# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Admin** (department leads / IT): full CRUD on all resources, user management, system configuration. Creates operator accounts, manages formulas, designs, inventory, and reviews samples.
- **Operator** (painting operators / lab staff): searches Pantone codes, views formulas with ingredient recipes, registers physical samples, logs inventory consumption. Primary daily-use role on the plant floor via mobile.

Both roles are internal to Telary Home's painting department. No public registration — operators are created exclusively by admin.

## Product Purpose

Telary Color is a color formula management system for the painting department of Telary Home. Its purpose is to **reduce waste of expensive raw materials** by giving operators instant, traceable access to Pantone codes and paint formulas — replacing fragmented spreadsheets and manual lookups with a single source of truth.

Success means: operators find the right formula in seconds, raw material consumption is accurately tracked, and the department has full traceability from Pantone color to formula to production design to inventory movement.

## Positioning

The differentiator over Excel or generic inventory tools is the **tight coupling between Pantone identity and formula traceability**: every color code links directly to its precise ingredient recipe (colorant + quantity in g/kg), which links to production designs and real-time inventory consumption. Operators don't waste time searching or guessing — and they don't waste expensive colorants on wrong formulas.

## Operating Context

- **Industry**: Industrial paint manufacturing — Pantone-based color matching for coatings.
- **Environment**: Internal LAN deployment. Operators access the app on mobile phones via the local network. No HTTPS, no external access.
- **Workflow**: Operator searches a Pantone code → sees the formula with exact ingredient quantities → registers consumption against a design → inventory updates in real time. Admin oversees the full chain and manages users.
- **Language**: All UI, labels, routes, and data in Spanish.
- **Deployment**: Single-origin architecture — FastAPI serves both the API and the React SPA. SQLite database, no external services.

## Capabilities and Constraints

- **Pantone catalog**: codes with gamut (C/TPX/U), paint type (reactiva/pigmento), hex preview. Prefix search by code.
- **Formulas**: named formulas linked to a Pantone, with ingredient list (colorant name, quantity in g/kg, fixed-precision Numeric(10,4)).
- **Designs**: production designs (1–7 Pantone colors each), linked to formulas via FormulaDesign.
- **Inventory**: stocked supplies (colorants, base pastes) with supplier/city, reorder thresholds, and alerts. Transactions: entrada (+), consumo (−, linked to formula+design), ajuste (−).
- **Samples**: physical sample tracking with optional photo upload (max 5 MB), status lifecycle (aprobada/archivada_reutilizable/descartada).
- **User management**: admin-only CRUD for creating operator accounts.
- **Access logs**: audit trail of data-mutating actions and logins.
- **PWA install**: "Add to home screen" on mobile LAN — no service worker (HTTPS out of scope).
- **SQLite**: all enums are VARCHAR columns validated in Python. Alembic migrations mandatory on every deploy.
- **Single-origin** (ADR-2): backend serves both API and SPA, no CORS.

## Brand Commitments

- Name: **Telary Color** (Telary is the company name — the project is being presented as a potential software integration for Telary Home).
- Theme color: `#1e3a8a` (deep blue).
- No formal visual identity system, logo, or typography guidelines yet — the product is in proposal phase for internal adoption.

## Evidence on Hand

- Running application with full CRUD for Pantone colors, formulas, designs, samples, inventory, and user management.
- 5 Alembic migrations (0001→0005) tracking schema evolution.
- SQLite database with real data at `backend/data/app.db`.
- PWA manifest with icons (192×192, 512×512).
- Frontend: React 19 + React Router 7 + Vite 8 + Tailwind CSS 4.
- Backend: FastAPI 0.141 + SQLAlchemy 2.0 + PyJWT auth.

## Product Principles

1. **Traceability over speed**: every inventory movement must link back to a formula and design — no anonymous consumption.
2. **Instant lookup**: the primary UX loop is search-by-Pantone-code; operators should never wait or navigate more than two taps to see a formula.
3. **Material savings**: the system exists to reduce waste of expensive colorants — accurate quantities and real-time stock visibility are non-negotiable.
4. **Closed system**: no public access, no self-registration — every user is explicitly provisioned by admin.
5. **Single source of truth**: one Pantone code maps to one canonical set of formulas — no duplicate or conflicting records.

```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:21a7784d799d32f2618ce9c078831e6f7e652eb53eb8b3d275005911c05947e5
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 14/14
test_command: cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest tests/test_pantone_colors.py tests/test_formulas.py
test_exit_code: 0
test_output_hash: sha256:51a77aa8f4ea0e6257f579419af8b68c46ef0268a39fc131978c9d08fffa2be8
build_command: cd /root/TelaryColor/backend && DATABASE_URL=sqlite:////tmp/telary_verify_sliced.db ./.venv/bin/python -m alembic upgrade head
build_exit_code: 0
build_output_hash: sha256:f88ce7928af8bb72e66cdeee9242c48f70d978320adf06288b8844b642a82dc6
```

## Verification Report

**Change**: telary-color-mvp-fase1-arquitectura-base
**Slice**: B (tasks 2.1-2.4) — Data Layer (models, single initial migration, idempotent seed admin).
**Version**: base spec (current) + delta specs (users, pantone-colors, formulas, designs, access-logs)
**Mode**: Strict TDD
**Date**: 2026-08-27

### Prior Verification Context (Slice A — carried forward, not re-assessed)

The slice A report is superseded by this combined file; its verdict line remains the record for slice A scope:

```yaml
# Slice A verdict (context only — see the replaced file history for the full report)
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0c7e8445f031895e3e201bf774acf1df9a58c6b6d587149e3643edd12b0bd11a
verdict: pass
requirements: 5/5
scenarios: 6/6
test_exit_code: 0
build_exit_code: 0
```

```yaml
# Slice B verdict (context only — full record in the Slice B section below)
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:77a0c056ea31977f8a7da6ed9d7acf182fcee9d2d80032ca07b734b5b22247f8
verdict: pass
requirements: 3/3
scenarios: 5/5
test_exit_code: 0
build_exit_code: 0
```

Slice A (Foundation, tasks 1.1-1.5): PASS, 5/5 requirements, 6/6 scenarios within the slice A assessment universe, evidence_revision `sha256:0c7e8445…`. Its deferrals (REQ-02 migration → PR B, REQ-04 static mount → PR E) are now partially resolved by this slice (REQ-02) and remain pending for REQ-04. Slice A runtime behaviors are re-confirmed by this slice's full-suite run: `test_boot.py`, `test_db.py`, and `test_config.py` still pass (13/13 total).

**Assessment universe (scope note)**: This slice's envelope totals are the spec requirements/scenarios whose observable data-layer behavior is delivered by tasks 2.1-2.4 and proven at runtime: 3 of 5 data-layer-relevant requirements and 5 of 21 data-layer-relevant scenarios. The 11 constraint-level scenarios from the delta specs (roles enum, unique code/name/duplicate-reference, default gamut, cascade deletes, NUMERIC/unit storage, FK links, immutable audit FK) are implemented at the data layer and recorded as static + probe evidence below, but their full-stack behavior (API validation/status codes/audit) lands in Phases 3-8; they are DEFERRED, not slice B defects. Items from other domains (auth endpoints, RNA CRUD, frontend) are out of slice B scope and not assessed.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (slice B) | 4 |
| Tasks complete | 4 |
| Tasks incomplete | 0 |

All slice B tasks (2.1-2.4) are marked `[x]` in `tasks.md` and in the slice B section of `apply-progress.md`. Slice B commits exist on the branch: `e7707e8` (2.1 RED: migration test) and `69e0072` (2.2-2.4: models/migration/seed/bcrypt primitives). HEAD is `0e7c908` (docs: slice B apply progress). Working tree clean at verification time.

### Build & Tests Execution (independent re-runs, not trusted from apply-progress)

**Build (schema build)**: ✅ Passed
```text
cd /root/TelaryColor/backend && DATABASE_URL=sqlite:////tmp/telary_verify_sliceb.db ./.venv/bin/python -m alembic upgrade head
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial, create all seven domain tables
exit 0 — output sha256:f88ce7928af8bb72e66cdeee9242c48f70d978320adf06288b8844b642a82dc6
```
Note: slice B touches no frontend, so the slice A `npm run build` is unchanged and out of scope; the alembic migration is the slice B "build" (schema construction). Alembic's INFO logs go to stderr; the hash covers the exact combined capture.

**Tests**: ✅ 13 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest tests/ -q
.............                                                            [100%]
13 passed, 1 warning in 12.99s
exit 0 — stdout sha256:25ff3273113a15e9533534b5c458ec4e5a75bca741836efcd2cef180f51a8236
(1 StarletteDeprecationWarning: httpx with starlette.testclient deprecated — upstream note, carried from slice A)
```

**Runtime harness — migration idempotency (fresh DB, /tmp/telary_verify_sliceb.db)**: ✅ Passed
- Run 1 (`alembic upgrade head`): exit 0, created 7 domain tables via `0001_initial`.
- Run 2 (same DB, `alembic upgrade head`): exit 0, logs show no `Running upgrade` step (no pending changes); table set identical.
- `sqlite_master` inspection: `{access_logs, design_colors, designs, formula_ingredients, formulas, pantone_colors, users}` all present; only extra table is `alembic_version`; `alembic_version` row = `0001_initial` (single revision, head).

**Runtime harness — seed idempotency (same DB)**: ✅ Passed
- Run 1 (`python -m app.seed`): exit 0 — 1 admin created (`admin` / role `admin`, bcrypt `$2b$12$…`, `full_name=Administrador`, `created_at` naive UTC `2026-08-27 20:52:05.240598`).
- Run 2 (`python -m app.seed`): exit 0 — `ADMIN_COUNT = 1`, `TOTAL_USERS = 1`; full-row snapshot byte-identical to run 1 (same password hash — no re-hash, no row touched).

**Schema/data probes (direct SQLite + ORM)**: ✅ All passed
- Formula cascade: delete a formula → its 2 `formula_ingredients` rows removed (DB-level `ON DELETE CASCADE` + PRAGMA foreign_keys=ON).
- Duplicate design color: 2nd insert of same `(design_id, pantone_color_id)` → `UNIQUE constraint failed: design_colors.design_id, design_co…` (IntegrityError).
- Duplicate pantone code: 2nd insert of same `code` → `UNIQUE constraint failed: pantone_colors.code`.
- ORM UTC: seeded admin `created_at` loads with `tzinfo is None` (naive UTC, per design decision #8).
- bcrypt: stored hash prefix `$2b$`; `verify_password("telary-admin", hash)` → True (also asserted in `test_seed.py`).

**Coverage**: ➖ Not available — `pytest-cov` not installed. Reported, not a failure.

### Spec Compliance Matrix (slice B assessment universe)
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-01 Data Layer (SQLite + SQLAlchemy 2.0) | Database available | `test_migration.py` + fresh-DB probe (7 tables present) | ✅ COMPLIANT |
| REQ-02 Single Initial Migration (Alembic) | Fresh upgrade | `test_migration.py > test_upgrade_head_creates_all_seven_tables` + manual fresh-DB run | ✅ COMPLIANT |
| REQ-02 Single Initial Migration (Alembic) | Already applied | `test_migration.py > test_upgrade_head_is_idempotent` + manual rerun (no pending changes) | ✅ COMPLIANT |
| users: Seed Admin (idempotent) | Fresh database | `test_seed.py > test_seed_creates_one_admin` + manual `python -m app.seed` | ✅ COMPLIANT |
| users: Seed Admin (idempotent) | Admin already present | `test_seed.py > test_seed_is_idempotent_data_unchanged` + manual snapshot diff | ✅ COMPLIANT |
| users: Roles (admin/operator) | Invalid role value | (API validation — Phase 4) | ➖ DEFERRED — static: `Role` enum exactly {admin, operator}, `users.role` VARCHAR(20) |
| pantone: Color CRUD | Duplicate code | (409 — Phase 5) | ➖ DEFERRED — static+probe: `UNIQUE(code)` + `ix_pantone_colors_code` |
| pantone: Gamut & Paint Type | Default gamut | (create — Phase 5) | ➖ DEFERRED — static: `gamut` `server_default 'C'` |
| pantone: Gamut & Paint Type | Invalid paint type | (validation — Phase 5) | ➖ DEFERRED — static: `PaintType` {reactiva, pigmento} |
| formulas: CRUD + Nested Ingredients | Cascade delete | (API delete — Phase 6) | ➖ DEFERRED — static+probe: `ON DELETE CASCADE` on `formula_ingredients.formula_id` |
| formulas: Ingredient Fields | Invalid unit / Invalid quantity | (validation — Phase 6) | ➖ DEFERRED — static: `quantity NUMERIC(10,4)`, `unit` VARCHAR(10) (Unit {g, kg}) |
| formulas: Formula to Pantone Link | Valid / Nonexistent reference | (API — Phase 6) | ➖ DEFERRED — static: FK `pantone_color_id → pantone_colors.id` NOT NULL |
| designs: Design Fields | Duplicate name | (API — Phase 7) | ➖ DEFERRED — static: `designs.name` UNIQUE |
| designs: No Duplicate Color References | Duplicate color | (API — Phase 7) | ➖ DEFERRED — static+probe: `uq_design_color (design_id, pantone_color_id)` rejects duplicates at DB |
| designs: Cascade Delete of Link Rows | Delete design | (API + audit — Phase 7/8) | ➖ DEFERRED — static+probe: `ON DELETE CASCADE` on `design_colors.design_id` |
| access-logs: Audit Record Integrity | Historical record unchanged | (API — Phase 8) | ➖ DEFERRED — static: `access_logs.user_id → users` NO ACTION (no update cascade; row not auto-modified) |

**Compliance summary**: 5/5 scenarios compliant within the slice B assessment universe; 0 UNTESTED (assessed rows all have passing covering tests); 0 FAILING; 11 data-layer constraint scenarios deferred to their API slices (Phases 4-8) with static/probe evidence recorded above — deferrals are scope, not defects. Remaining non-data-layer scenarios (auth, users CRUD, search, conversions, formula CRUD, design cardinality/audit/auth, frontend) are deferred to Phases 3-9 and not assessed here.

### Correctness (Static Evidence)
| Data-layer feature | Status | Notes |
|--------------------|--------|-------|
| 7 ORM models / 7 tables | ✅ Implemented | `modules/{users,pantone_colors,formulas,designs,access_logs}/models.py` → exactly the 7 spec tables; verified in fresh DB |
| Single initial migration | ✅ Implemented | `alembic/versions/0001_initial.py` only revision (`down_revision=None`); env.py imports all 5 model modules (no missing metadata); rerun no-op |
| Enum catalog | ✅ Implemented | `db/enums.py` (`PaintType`, `Unit`) + `users.Role` exactly admin/operator; stored as VARCHAR (`native_enum=False`) |
| UTC naive timestamps | ✅ Implemented | `db/base.utcnow()` = `datetime.now(timezone.utc).replace(tzinfo=None)`; stored values carry no offset; ORM probe confirms naive |
| NUMERIC decimal storage | ✅ Implemented | `formula_ingredients.quantity NUMERIC(10,4)` (design ADR-5: no float precision loss) |
| Cascade FKs | ✅ Implemented | `formula_ingredients.formula_id` and `design_colors.design_id` `ondelete=CASCADE` (DB + ORM `delete-orphan`); probe: 2 → 0 ingredients |
| Unique pair constraint | ✅ Implemented | `uq_design_color (design_id, pantone_color_id)`; probe: duplicate pair → IntegrityError |
| Unique + indexed pantone code | ✅ Implemented | `UNIQUE(code)` + `ix_pantone_colors_code` (supports `?q=` prefix search) |
| Idempotent seed admin | ✅ Implemented | `seed.ensure_admin` inserts only when no admin exists; 2 runs → 1 admin, snapshots identical |
| Seed env creds + fallback | ✅ Implemented | `config` `seed_admin_username/password` (env > `.env` > defaults `admin`/`telary-admin`, ADR-10) |
| bcrypt + 72-byte guard | ✅ Implemented | `security.hash_password` rejects >72 bytes (`PasswordTooLongError`); `verify_password` round-trip passes; no passlib (ADR-1) |
| Immutable audit FK | ✅ Implemented | `access_logs.user_id → users` NO ACTION (no update cascade) — audit rows cannot be auto-modified |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Data model (design.md data-model line) | ✅ Yes | Implemented columns/constraints match the design table definition exactly (unique usernames/codes/names, gamut default 'C', Numeric quantity, cascade FKs, `UniqueConstraint(design_id, pantone_color_id)`) |
| Decision #8: UTC everywhere | ✅ Yes | `utcnow()` naive-UTC; verified in stored data and ORM load |
| ADR-10: seed admin | ✅ Yes | config + `seed.py`, idempotent, env-overridable |
| ADR-5: decimal without FP loss | ✅ Yes | `Numeric(10,4)` |
| Enums as Python str enum → VARCHAR | ✅ Yes | `db/enums.py`, `SAEnum(..., native_enum=False)` |
| ADR-1: bcrypt direct (no passlib) | ✅ Yes | `security.py` uses `bcrypt` directly + explicit 72-byte guard (learning #5) |
| ADR-9: WAL + FK pragma | ✅ Yes (carried) | `session.py` event listener (slice A; FK pragma re-exercised by seed migration path) |
| bcrypt primitives pulled forward to slice B | ⚠️ Deviation (documented) | Needed by seed; auth router/JWT/require_roles stay Phase 3 — documented in apply-progress; does not break spec |
| Commit granularity 4 units → 2 commits | ⚠️ Deviation (documented) | Hook re-staging absorbed work units into `69e0072`; tree verified complete (no content loss) |

### OpenSpec Conventions
| Rule | Followed? | Notes |
|------|-----------|-------|
| RFC 2119 MUST/SHALL in specs | ✅ Yes | base + delta specs use MUST / MUST NOT / SHALL |
| Given/When/Then scenarios | ✅ Yes | all spec scenarios in Given/When/Then form |

### TDD Compliance (Strict TDD module)
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Slice B TDD Cycle Evidence table present (4 rows, RED/GREEN/TRIANGULATE/REFACTOR) |
| All tasks have tests | ✅ | 4/4 — `test_migration.py` (tasks 2.1/2.2), `test_seed.py` (tasks 2.3/2.4); GREEN tasks are driven by the RED tests |
| RED confirmed (test files exist) | ✅ | 2/2 test files exist and match the table; 2.1 RED committed separately (`e7707e8`); 2.3 RED documented (test written while `seed.py` missing) |
| GREEN confirmed (tests pass) | ✅ | 13/13 tests pass on independent execution (4 slice-B tests included) |
| Triangulation adequate | ✅ | Migration: 2 cases = exactly the 2 spec scenarios; seed: 2 cases = exactly the 2 spec scenarios; no multi-scenario behavior with a single test |
| Safety Net for modified files | ✅ | Both test files are new (N/A legitimate); no modified-file task claims N/A improperly |

**TDD Compliance**: 6/6 checks passed (1 ⚠️ note — 2.3 RED was observed but not committed separately; absorbed into `69e0072` and documented).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 0 | 0 | — |
| Integration | 4 | 2 | pytest: subprocess-alembic + SQLite (`test_migration.py`), ORM + SQLite (`test_seed.py`) |
| E2E | 0 | 0 | not installed / out of slice scope |
| **Total (slice B changed files)** | **4** | **2** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`pytest-cov` not installed). Not a failure.

### Assertion Quality
- `test_migration.py`: asserts `returncode == 0`, missing-tables set, and idempotency via table-set equality — all call production (alembic + SQLite) and assert concrete values. Minor redundancy: `assert EXPECTED_TABLES.issubset(tables)` is logically implied by `assert not missing` (harmless defensive duplicate → SUGGESTION).
- `test_seed.py`: asserts `created is True`, exactly 1 admin, username/role values, hash ≠ plaintext, `$2` prefix, `verify_password` round-trip, full-row snapshot equality after second seed, and count == 1 — all real behavior.
- No tautologies, ghost loops, type-only-only assertions, smoke-only checks, or implementation-detail coupling found.

**Assertion quality**: ✅ All assertions verify real behavior (1 SUGGESTION for a redundant subset assert)

### Quality Metrics
**Linter**: ➖ Not available (no flake8/ruff configured)
**Type Checker**: ➖ Not available (Python; pytest + runtime used as the executable check)
**Coverage**: ➖ Not available (pytest-cov missing)

### Issues Found
**CRITICAL**: None

**WARNING**: None

**SUGGESTION**:
1. `test_migration.py:64` — `assert EXPECTED_TABLES.issubset(tables)` duplicates `assert not missing` (line 63); logically implied, harmless. Could be dropped for clarity.
2. Apply-progress commit-table drift (cosmetic): table lists `69e0072` as "feat(backend): add data layer — models, migration, seed, bcrypt primitives (2.2–2.4)" but the actual message is "feat(backend): add data models for the seven entities"; the HEAD docs commit `0e7c908` (slice B apply progress) is not listed in the table; and "test_migration ×3" counts 3 subprocess runs while the file has 2 test functions (13 total = 9 slice A + 2 migration + 2 seed). No content impact — tree inspected and complete.
3. `unique=True, index=True` on `users.username` / `pantone_colors.code` yields a UNIQUE constraint auto-index plus an explicit duplicate index in SQLite; harmless (spec requires unique + indexed) — optional cleanup for a future revision.
4. StarletteDeprecationWarning (httpx → `httpx2`) on every pytest run — carried from slice A; upstream note, no action for this slice.

### DEFERRED (out of slice B scope — NOT defects)
- REQ-04 Single-Origin Deployment: "SPA served from same origin" → PR E (task 8.2), as recorded in slice A.
- Users: admin user-management endpoints, `last_access_at` on login, admin UI → Phases 3/4/9.
- Pantone: CRUD/search endpoints (incl. 409 duplicate) → Phase 5.
- Formulas: CRUD/ingredient/conversion endpoints (incl. kg→g, sub-gram) → Phase 6.
- Designs: 1–7 cardinality (app-level, per design-time note), duplicate-name 409, audit, auth → Phases 7/8.
- Access-logs: mutation/login logging behavior → Phase 8.
- Frontend screens and UI language → Phase 9.

### Verdict
**PASS** — Slice B (tasks 2.1-2.4) is complete and proven within the slice B assessment universe: full suite 13/13 passes (exit 0, stdout sha256 `25ff3273…`); single initial migration creates exactly the 7 domain tables on a fresh DB and re-running reports no pending changes (build exit 0, output sha256 `f88ce792…`); seed is idempotent (2 runs → 1 admin, byte-identical data); schema invariants (NUMERIC(10,4), naive-UTC timestamps, cascade FKs, unique pairs, unique+indexed code, `server_default 'C'`, immutable audit FK) verified by direct probes; TDD evidence complete (6/6). All deferred items are scope deferrals to Phases 3-9, not slice B defects.

### Verification Environment
- Workspace: /root/TelaryColor (git branch `feat/slice-a-foundation`, HEAD `0e7c908`)
- Slice B candidate tree: `git rev-parse HEAD^{tree}` = `919899a5c704e12da4b7dac620ef9fd2311a17ca`; envelope `evidence_revision` = sha256 of that tree hash string (`77a0c056…`)
- Backend venv: `backend/.venv` (Python 3.13.7)
- Commands executed by verifier: `./.venv/bin/python -m pytest tests/ -q` (exit 0), `DATABASE_URL=sqlite:////tmp/telary_verify_sliceb.db ./.venv/bin/python -m alembic upgrade head` ×2 (exit 0), `DATABASE_URL=sqlite:////tmp/telary_verify_sliceb.db ./.venv/bin/python -m app.seed` ×2 (exit 0), direct SQLite/ORM probes
- Evidence hashes: pytest stdout `sha256:25ff3273…`; migration output `sha256:f88ce792…`; evidence revision `sha256:77a0c056…`

---

## Verification Report — Slice C (Auth + Users)

**Change**: telary-color-mvp-fase1-arquitectura-base
**Slice**: C (tasks 3.1, 3.2, 4.1, 4.2) — Auth (JWT login, current user, DI deps, no CORS) + Users (admin-only CRUD, roles, audit) + access-logs behavior for the auth/users domain.
**Version**: auth spec (current) + users spec (slice C scope) + access-logs spec (slice C scope) + base spec (Strict TDD requirement)
**Mode**: Strict TDD
**Date**: 2026-08-27

### Assessment Universe (slice C scope note)

The envelope totals are the requirements/scenarios whose observable behavior ships in tasks 3.1-4.2 and is proven at runtime here: 10 requirements / 16 scenarios across the auth, users, and access-logs specs, assessed for the auth/users domain only. Items owned by other slices are recorded under DEFERRED below — deferrals, not slice C defects. The users "Seed Admin" requirement (2 scenarios) is DEFERRED to slice B, where it was verified; its `test_seed.py` still re-passes in this slice's full suite. The users "Minimal Admin UI Page" requirement is DEFERRED to slice F (Phase 9 frontend).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (slice C) | 4 |
| Tasks complete | 4 |
| Tasks incomplete | 0 |

All slice C tasks (3.1, 3.2, 4.1, 4.2) are marked `[x]` in `tasks.md` and recorded in the slice C section of `apply-progress.md`. Slice C commits on the branch: `7396391` (3.1 RED auth tests), `0fa06ec` (3.2 GREEN auth), `800bdec` (4.1 RED users tests), `d1990db` (4.2 GREEN users); HEAD is `915d1a6` (docs: slice C apply progress). Working tree clean at verification time. RED-before-GREEN is confirmed: the auth test file existed before the auth router (`7396391` touches only `conftest.py` + `test_auth.py`), and the users test file existed before the users router (`800bdec` touches only `test_users.py`).

### Build & Tests Execution (independent re-runs, not trusted from apply-progress)

**Build (schema bootstrap)**: ✅ Passed — slice C changes no schema (commit stats for `0fa06ec`/`d1990db` touch no model or migration file). The handshake DB was bootstrapped on the documented path:
```text
cd /root/TelaryColor/backend && DATABASE_URL=sqlite:////tmp/telary_verify_slicec.db ./.venv/bin/python -m alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial, create all seven domain tables
exit 0 — output sha256:f88ce792… (byte-identical to slice B's migration output — same single migration, same result)
```
`python -m app.seed` (same env) exit 0 → exactly 1 user: `admin` / role `admin` / `full_name=Administrador`, `last_access_at=None`, 0 `access_logs` rows — the exact bootstrap state the runtime handshake needs. App assembly (`create_app()` mounting both new routers) is proven by the handshake below.

**Tests**: ✅ 41 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest -q
41 passed, 45 warnings in 49.01s
exit 0 — stdout sha256:de29e1f7bfb8a913eacda69f8c31a3c3a80f46a165e1489cd9894a2688d0c738
```
(45 warnings = PyJWT `InsecureKeyLengthWarning` emission points, see Issues, plus the slice-A-carried `StarletteDeprecationWarning`.)

**Focused tests (slice C acceptance)**: ✅ 28 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest -q tests/test_auth.py tests/test_users.py
28 passed, 45 warnings in 24.11s
exit 0 — stdout sha256:260fd79bb9dac354d157930276d205d2a605fe119457abec7834fbfecf3c73fc
```
(9 auth tests + 19 users tests = 28. apply-progress records "5 auth + 23 users" — same total, wrong per-file split; cosmetic, see Issues.)

**Runtime handshake (independent, real stack, seeded DB)**: ✅ 49/49 checks passed
The handshake ran the unmodified application (no dependency overrides) against the seeded temp DB (`/tmp/telary_verify_slicec.db`), exercising the real OAuth2 form → bcrypt → JWT → DI → SQLite path end-to-end. Key proven behaviors:
- Login `admin`/`telary-admin` → 200; JWT decodes: `sub=admin`, `exp` remaining > 11h and ≤ 12h from issuance; `token_type=bearer`; profile `role=admin`; no `password_hash` in any response.
- `users.last_access_at` set on login; exactly one `login` `access_logs` row written for the admin in the same transaction.
- Bad password → 401 with no token; unknown user → 401; >72-byte password → 422.
- `GET /auth/me`: valid token → 200 admin profile; missing / invalid / expired (minted with past `exp`) tokens → 401.
- Users enforcement: unauthenticated → 401; operator token → 403 on list/create/patch/delete, and operator create writes no row.
- Admin CRUD: create 201 → read (list) 200 → update 200 (role+name applied) → delete 204 (row gone).
- Duplicate username → 409; invalid role → 422; >72-byte create password → 422.
- Audit: read-only GETs (`/users`, `/auth/me`) add no `access_logs` rows; `user.create`/`user.update`/`user.delete` rows present for the acting admin.
- Delete of a user with audit history → 409 and the user survives (audit trail protected); a historical audit row is byte-identical after a profile update.
- CORS: no `CORSMiddleware` in the middleware stack; responses carry no `access-control-allow-origin`.
exit 0 — stdout sha256:b2a6a7a3c57333a60e1ad90141d375ce6657297766472bf2f3beb37242fc79d8

**Coverage**: ➖ Not available — `pytest-cov` not installed. Reported, not a failure.

### Spec Compliance Matrix (slice C assessment universe)
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| auth: JWT Login | Successful login (200, 12h JWT, last_access_at) | `test_auth.py > test_login_success_returns_token_updates_last_access_and_audits` + handshake | ✅ COMPLIANT |
| auth: JWT Login | Invalid password (401, no token) | `test_auth.py > test_login_wrong_password_returns_401`, `test_login_unknown_user_returns_401` | ✅ COMPLIANT |
| auth: Current User | Valid token (200 profile) | `test_auth.py > test_me_with_valid_token_returns_profile` | ✅ COMPLIANT |
| auth: Current User | Missing or expired token (401) | `test_auth.py > test_me_without_token_returns_401`, `test_me_with_invalid_token_returns_401`, `test_me_with_expired_token_returns_401` | ✅ COMPLIANT |
| auth: Password Hashing & Validation | Password within 72-byte limit | `test_seed.py` verify round-trip + login success + `test_users.py` create (bcrypt `$2` hash, verify round-trip) | ✅ COMPLIANT |
| auth: Password Hashing & Validation | Password exceeding limit (validation error) | `test_auth.py > test_login_password_over_72_bytes_returns_422`, `test_users.py > test_create_user_password_too_long_returns_422` | ✅ COMPLIANT |
| auth: DI-based Auth Dependencies | Protecting an endpoint (401 before logic) | `test_me_without_token_returns_401`, `test_require_roles_admits_admin_and_rejects_operator`, users 401 tests; CORS absence static + runtime | ✅ COMPLIANT |
| users: Admin-only User Management | Admin manages users (list/create/change role) | `test_users.py > test_admin_lists_users`, `test_admin_creates_user_*`, `test_admin_updates_user_role`, `test_admin_deletes_user`, `test_write_actions_are_audited` | ✅ COMPLIANT |
| users: Admin-only User Management | Operator cannot create users (403, no row) | `test_users.py > test_operator_cannot_create_user_and_no_row_written` + handshake | ✅ COMPLIANT |
| users: Admin-only User Management | Unauthenticated (401) | `test_users.py > test_list_users_unauthenticated_returns_401`, `test_create_user_unauthenticated_returns_401` | ✅ COMPLIANT |
| users: Roles (admin / operator) | Invalid role value (validation error) | `test_users.py > test_create_user_invalid_role_returns_422`, `test_update_user_invalid_role_returns_422` | ✅ COMPLIANT |
| users: last_access_at tracking | Successful login updates it | `test_auth.py > test_login_success_…` + handshake (admin and operator logins) | ✅ COMPLIANT |
| access-logs: Mutating actions logged | Mutating action logged | `test_users.py > test_write_actions_are_audited` + handshake (create/update/delete rows) | ✅ COMPLIANT |
| access-logs: Mutating actions logged | Read-only action not logged | runtime handshake (`GET /users` + `GET /auth/me` add no rows) | ✅ COMPLIANT |
| access-logs: Login auditing | Successful login logged | `test_auth.py > test_login_success_…` + handshake (admin `login` row) | ✅ COMPLIANT |
| access-logs: Audit Record Integrity | Historical record unchanged | handshake (profile update → audit row byte-identical) + `test_delete_user_with_audit_history_returns_409` + statically verified FK NO ACTION | ✅ COMPLIANT |

**Compliance summary**: 16/16 scenarios compliant in the slice C assessment universe; 0 UNTESTED; 0 FAILING. One committed-test gap: the read-only-not-logged negative is proven by the independent runtime probe but not yet locked by a committed pytest — SUGGESTION below.

### Correctness (Static Evidence)
| Feature | Status | Notes |
|---------|--------|-------|
| bcrypt direct, no passlib | ✅ Implemented | `security.py` uses `bcrypt.hashpw`/`checkpw` directly (ADR-1); explicit 72-byte guard at hash, schema validator, and login |
| HS256 JWT, 12h expiry | ✅ Implemented | `create_access_token`/`decode_access_token`; `sub` = username (the immutable identity); `exp` = 12h default (`access_token_expire_hours`) |
| OAuth2 password form | ✅ Implemented | `OAuth2PasswordRequestForm` on `POST /auth/login`; `python-multipart` pinned; `OAuth2PasswordBearer(tokenUrl=…)` wires Swagger Authorize |
| DI dependencies | ✅ Implemented | `get_current_user` → 401 on any `jwt.PyJWTError`, missing `sub`, or unknown user; `require_roles(*roles)` → 403; both return 401/403 before business logic |
| No CORS | ✅ Implemented | No `CORSMiddleware` anywhere in the codebase (grep) or the middleware stack (runtime) |
| Login audit + last_access | ✅ Implemented | `auth/router.py` updates `last_access_at` and logs `login` in the same transaction, commits before issuing the JWT (design Auth Flow) |
| Admin-only users CRUD | ✅ Implemented | `require_roles(Role.admin)` on list/create/patch/delete; 403 operator; 401 unauthenticated; operator create writes no row |
| Validation | ✅ Implemented | duplicate username 409; invalid role 422 (`Role` enum exactly {admin, operator}); >72-byte password 422; FK-integrity delete → 409 |
| Password never leaks | ✅ Implemented | `UserOut` omits `password_hash`; runtime probes confirm no hash/plaintext in login, me, create, list, update responses |
| Audit on every write, none on reads | ✅ Implemented | `access_logs/service.py:log_action` — `user.create`/`user.update`/`user.delete` + `login`; read-only handlers never log |
| English API ids / Spanish UI messages | ✅ Implemented | API field names English (`username`, `password`, `access_token`, `token_type`, `role`, `last_access_at`); user-facing `detail` strings Spanish |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| ADR-1: bcrypt direct + PyJWT HS256 | ✅ Yes | `security.py` matches exactly; no passlib |
| Auth Flow (72B guard → bcrypt → last_access + audit same tx → 12h JWT) | ✅ Yes | `auth/router.py:login` matches the design sequence line-for-line |
| `get_current_user`/`require_roles` in `core/deps.py` | ✅ Yes | 401/403 semantics per design |
| ADR-3: bearer token from localStorage, no cookie | ✅ Yes | `OAuth2PasswordBearer` → `Authorization: Bearer` only |
| Single-origin, no CORS | ✅ Yes | no CORS middleware (static SPA mount itself still deferred to slice E) |
| API surface codes | ✅ Yes | login 200/401/422, me 200/401, users 200/201/403/404/409/422, delete 204 — all exercised at runtime |
| Module layout (schemas/router per module) | ✅ Yes | `auth/{schemas,router}.py`, `users/{schemas,router}.py` |
| Audit helper single point | ⚠️ Deviation (documented) | `access_logs/service.py` added so auth + users share one audit write path; design sketched inline per-router logging — documented in apply-progress, no spec break |
| Login response shape | ⚠️ Deviation (additive superset) | response includes the `user` profile alongside design's `{access_token, token_type}`; auth spec only requires the JWT, so this extends, does not break |

### TDD Compliance (Strict TDD module)
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Slice C TDD Cycle Evidence table present (4 rows: 3.1, 3.2, 4.1, 4.2) |
| All tasks have tests | ✅ | 4/4 — 3.1/3.2 driven by `test_auth.py`; 4.1/4.2 driven by `test_users.py` |
| RED confirmed (tests exist) | ✅ | 2/2 test files exist; RED committed before GREEN in separate commits: `7396391` (auth, before router existed), `800bdec` (users, before router existed) |
| GREEN confirmed (tests pass) | ✅ | 28/28 slice C tests pass on independent execution (41/41 full suite) |
| Triangulation adequate | ✅ | auth: 9 test cases over the 5 auth behaviors; users: 19 test cases over 8 users behaviors — no multi-scenario behavior rests on a single test |
| Safety Net for modified files | ✅ | `test_auth.py`, `test_users.py`, `conftest.py` are all new in the RED commits (N/A legitimate); no modified-file task claims N/A improperly |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 0 | 0 | — |
| Integration | 28 | 2 | pytest + TestClient + temp-file SQLite + real bcrypt/JWT primitives |
| E2E | 0 | 0 | not installed / out of slice scope |
| **Total (slice C)** | **28** | **2** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`pytest-cov` not installed). Not a failure.

### Assertion Quality
- `test_auth.py`: asserts real status codes, JWT claims (`sub`, `exp` within an 11h < remaining ≤ 12h window), `last_access_at` set, the `login` audit row with matching `user_id`, response never leaking `password_hash`, and 401 for missing/invalid/expired tokens — all execute the production path and assert concrete values.
- `test_users.py`: asserts status codes, DB row effects (created user verified via ORM, role updated in DB, deleted row gone, operator create writes no row), bcrypt hash properties (`$2` prefix, hash ≠ plaintext, `verify_password` round-trip), duplicate-username 409, invalid-role 422, audit action tuples, and FK-integrity 409 with a survival check.
- The `auth_headers` fixture mints tokens directly with `jwt.encode` (same secret, HS256) instead of going through login — intentional token factory per design "Tests" section; the login path itself is fully covered by `test_auth.py`.
- No tautologies, ghost loops, type-only-only assertions, smoke-only checks, or implementation-detail coupling found.

**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ➖ Not available (no flake8/ruff configured)
**Type Checker**: ➖ Not available (Python; pytest + runtime handshake used as the executable check)
**Coverage**: ➖ Not available (pytest-cov missing)

### Issues Found
**CRITICAL**: None

**WARNING**:
1. `InsecureKeyLengthWarning` (PyJWT, RFC 7518 §3.2): the configured `secret_key` (`dev-secret-change-me`, 20 bytes) is below PyJWT's 32-byte minimum for HS256 and every token encode/decode emits the warning. Tokens sign and verify correctly and `config.py` documents the production override (`SECRET_KEY` env / `.env`), so this is a hardening follow-up, NOT a slice C blocker. Follow-up: set a ≥32-byte key via env/`.env` and add `InsecureKeyLengthWarning` to the pytest filterwarnings to keep the suite warning-clean.

**SUGGESTION**:
1. The access-logs "Read-only action not logged" negative is proven only by the independent runtime probe, not by a committed pytest; a small test (reads add no `access_logs` rows) would lock the behavior against regression.
2. apply-progress slice C records "28 passed (5 auth + 23 users)" — the actual split is 9 auth + 19 users (total 28 correct). Cosmetic miscount.
3. apply-progress slice C states `backend/data/app.db` was "already migrated + seeded"; at verification time the file does not exist and there is no `backend/.env` (seed defaults `admin`/`telary-admin` apply). The verifier bootstrapped its own temp DB via the documented `alembic upgrade head` → `python -m app.seed` path; no impact on the slice C verdict, but the apply note is stale.
4. `LoginResponse` carries the `user` profile beyond the design's `{access_token, token_type}` — additive superset, non-breaking (clients gain the profile for free).
5. Carried from slice A: StarletteDeprecationWarning (httpx → httpx2) on every pytest run — upstream note.
6. Carried from slice B: `unique=True, index=True` on `users.username` yields a UNIQUE auto-index plus an explicit duplicate index in SQLite — harmless, optional future cleanup.

### DEFERRED (out of slice C scope — NOT defects)
- users: Seed Admin (fresh database / admin already present) → verified in slice B; `test_seed.py` re-passes in this slice's full suite.
- users: Minimal Admin UI Page (Spanish UI, manage users) → slice F (Phase 9 frontend).
- access-logs: mutating-action logging for pantone/formulas/designs resources → slices D/E.
- base: REQ-04 SPA static mount (single-origin) → slice E (task 8.2).
- Remaining data-layer constraint scenarios already recorded as DEFERRED in the slice B section (gamut default, cascade deletes, NUMERIC/unit storage, FK links, design 1–7 cardinality, unique pairs) → their API slices D/E; the roles enum and audit-integrity rows from that list are now exercised end-to-end by this slice.

### Verdict
**PASS** — Slice C (tasks 3.1, 3.2, 4.1, 4.2) is complete and proven: full suite 41/41 (exit 0, stdout sha256 `de29e1f7…`); focused slice C acceptance 28/28 (exit 0, stdout sha256 `260fd79b…`); an independent 49-check runtime handshake against the seeded DB proves login 200 with a decodable 12h JWT (`sub=admin`), `last_access_at` + `login` audit in the same transaction, 401/422 failure paths, the `/auth/me` token matrix, admin-only users CRUD (201 → 200 → 200 → 204) with 409 duplicate / 422 invalid-role / 403 operator / 401 unauthenticated, audit rows on every write and login with none on reads, immutable audit records, and no CORS. TDD evidence 6/6 with RED commits `7396391` + `800bdec` landing before their GREENs. One non-blocking WARNING (JWT secret 20B < the 32B RFC-recommended minimum) is recorded for follow-up; all remaining items are SUGGESTIONs or cross-slice deferrals.

### Verification Environment (slice C)
- Workspace: /root/TelaryColor (git branch `feat/slice-a-foundation`, HEAD `915d1a65` — `docs(sdd): record slice C auth+users apply progress`)
- Slice C candidate tree: `git rev-parse HEAD^{tree}` = `ac426fc62dba646a86223517ad85f3e3b0ca33e1`; envelope `evidence_revision` = sha256 of that tree hash string (`554d06de…`)
- Backend venv: `backend/.venv` (Python 3.13.7)
- Handshake DB: fresh `/tmp/telary_verify_slicec.db` bootstrapped via `alembic upgrade head` (exit 0, output sha256 `f88ce792…`, byte-identical to slice B) + `python -m app.seed` (exit 0 → 1 admin, 0 audit rows)
- Commands executed by verifier: `./.venv/bin/python -m pytest -q` (exit 0, stdout sha256 `de29e1f7…`), `./.venv/bin/python -m pytest -q tests/test_auth.py tests/test_users.py` (exit 0, stdout sha256 `260fd79b…`), `PYTHONPATH=/root/TelaryColor/backend DATABASE_URL=sqlite:////tmp/telary_verify_slicec.db ./.venv/bin/python /tmp/telary_slicec_handshake.py` (exit 0, 49/49 checks, stdout sha256 `b2a6a7a3…`), direct SQLite probes
- Evidence hashes: full-suite stdout `sha256:de29e1f7…`; focused stdout `sha256:260fd79b…`; handshake stdout `sha256:b2a6a7a3…`; migration output `sha256:f88ce792…`; evidence revision `sha256:554d06de…`

---

## Verification Report — Slice D (Pantone Colors + Formulas)

**Change**: telary-color-mvp-fase1-arquitectura-base
**Slice**: D (tasks 5.1, 5.2, 6.1, 6.2) — Pantone colors CRUD + instant search + gamut/paint-type classification; formulas CRUD with nested ingredients + `quantity_g` unit conversion + pantone link.
**Version**: pantone-colors spec (current) + formulas spec (slice D scope) + auth/base specs (route-authentication expectations for the new routes).
**Mode**: Strict TDD
**Date**: 2026-08-28

```yaml
# Slice D verdict (latest assessment — top envelope reflects these counts)
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:21a7784d799d32f2618ce9c078831e6f7e652eb53eb8b3d275005911c05947e5
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 14/14
test_exit_code: 0
build_exit_code: 0
```

### Assessment Universe (slice D scope note)

The envelope totals are the requirements/scenarios whose observable behavior ships in tasks 5.1-6.2 and is proven at runtime here: **7 requirements / 14 scenarios** across the pantone-colors and formulas specs. The route-authentication expectations (401 unauthenticated on these resources; authed-not-admin-only role model) are enforced by the auth/base specs and proven end-to-end at runtime, recorded as cross-cutting evidence (not inflated into the slice D counts). Items owned by other slices are under DEFERRED below — deferrals, not slice D defects.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (slice D) | 4 |
| Tasks complete | 4 |
| Tasks incomplete | 0 |

All slice D tasks (5.1, 5.2, 6.1, 6.2) are marked `[x]` in `tasks.md`. Slice D commits on the branch: `4731e28` (5.1 RED pantone tests), `9d442f1` (5.2 GREEN pantone), `a19c8fe` (6.1 RED formulas tests), `dc84176` (6.2 GREEN formulas), `3aa2138` (docs: slice D apply progress). HEAD is `3aa2138`; working tree clean at verification time.

### Build & Tests Execution (independent re-runs, not trusted from apply-progress)

**Build (schema bootstrap)**: ✅ Passed — slice D changes no schema (commit stats for `9d442f1`/`dc84176` touch no model or migration file). The handshake DB was bootstrapped on the documented path:
```text
cd /root/TelaryColor/backend && DATABASE_URL=sqlite:////tmp/telary_verify_sliced.db ./.venv/bin/python -m alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial, create all seven domain tables
exit 0 — output sha256:f88ce792… (byte-identical to slices B and C — single migration unchanged)
```
`python -m app.seed` (same env) exit 0 → exactly 1 user: `admin` / role `admin`. App assembly (`create_app()` mounting the new pantone + formulas routers) is proven by the OpenAPI surface in the handshake below.

**Focused tests (slice D acceptance)**: ✅ 23 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest -q tests/test_pantone_colors.py tests/test_formulas.py
23 passed, 53 warnings in 37.83s
exit 0 — stdout sha256:51a77aa8f4ea0e6257f579419af8b68c46ef0268a39fc131978c9d08fffa2be8
```
(12 pantone tests + 11 formulas tests.)

**Full suite (regression)**: ✅ 64 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest -q
64 passed, 97 warnings in 103.85s
exit 0 — stdout sha256:52fcd07f8dc9b5fb37af4dab7c040c22374a46a87ecc03982798b88f4d20cd28
```
64/64 matches the prior slice baseline with no regressions (slice C was 41; slices D's 23 new tests bring the total to 64 after slice C's 41. The earlier 41 → 64 growth is exactly the 23 slice D tests with no other change.)

**Runtime handshake (independent, real stack, seeded DB)**: ✅ 51/51 checks passed
```text
PYTHONPATH=/root/TelaryColor/backend DATABASE_URL=sqlite:////tmp/telary_verify_sliced.db ./.venv/bin/python /tmp/telary_sliced_handshake.py
51 passed, 0 failed — exit 0 — stdout sha256:17c8d0b53e3c50c124ae2f80b191f3fb9bc1fd4b39da11684bf6bf6565c07f36
```
The handshake ran the unmodified application against a freshly migrated+seeded temp DB (`/tmp/telary_verify_sliced.db`, `alembic upgrade head` + `python -m app.seed`), exercising the real OAuth2 form → bcrypt → JWT → DI → SQLite path. The operator was provisioned through the real admin-only user-management API (`POST /users` 201) before being exercised, matching the documented bootstrap path. Key proven behaviors:
- Unauth → 401 on every pantone/formulas route (list + create both proven).
- Operator (non-admin) CAN create/read/patch/delete pantone colors and create/patch/delete formulas — these resources are authed-not-admin-only (unlike `/users`), per design roles.
- Pantone: create 201 with default `gamut=C`; read 200; patch 200 (paint_type+gamut applied); duplicate `code` create → 409 with the duplicate NOT persisted (DB count == 1); `?q=221` prefix search returns `{221C, 221U}`; `?q=221c` case-insensitive; `?q=nomatch` → empty list 200; invalid `paint_type=acuarela` → 422.
- Formulas: create with 2 nested ingredients → 201 with `created_by` (operator id), `created_at`, `updated_at`; delete → 204 and both the formula row and its ingredients are cascade-removed (DB counts 0).
- Conversion: `1 kg` → `quantity_g == 1000` (Decimal); `0.001 kg` → `quantity_g == 1` (sub-gram, no FP loss); original `unit`/`quantity` preserved in output; invalid `unit=litros` → 422; invalid `quantity=mucho` → 422.
- Link: formula referencing an existing pantone color → 201 linked; referencing `99999` → rejected (404/422).
- Audit: `pantone.create/update/delete` and `formula.create/update/delete` rows written; read-only GETs (`/pantone-colors`, `/formulas`) add no `access_logs` rows.
- `/openapi.json` carries `/api/v1/pantone-colors` + `/api/v1/pantone-colors/{color_id}` and `/api/v1/formulas` + `/api/v1/formulas/{formula_id}`.

**Coverage**: ➖ Not available — `pytest-cov` not installed. Reported, not a failure.

### Spec Compliance Matrix (slice D assessment universe)
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| pantone-colors: Pantone Color CRUD | Full CRUD cycle | `test_pantone_colors.py > test_full_crud_cycle`, `test_read_missing_returns_404` + handshake | ✅ COMPLIANT |
| pantone-colors: Pantone Color CRUD | Duplicate code | `test_duplicate_code_on_create_returns_409_not_persisted`, `test_duplicate_code_on_update_returns_409` + handshake (count==1) | ✅ COMPLIANT |
| pantone-colors: Instant Search by Code | Matching results | `test_search_q_prefix_matching_results`, `test_search_q_prefix_case_insensitive` + handshake | ✅ COMPLIANT |
| pantone-colors: Instant Search by Code | No matches | `test_search_q_no_matches_returns_empty_list` + handshake | ✅ COMPLIANT |
| pantone-colors: Gamut and Paint Type Classification | Invalid paint type | `test_invalid_paint_type_returns_422` + handshake | ✅ COMPLIANT |
| pantone-colors: Gamut and Paint Type Classification | Default gamut | `test_default_gamut_is_C` + handshake (gamut==C) | ✅ COMPLIANT |
| formulas: Formula CRUD with Nested Ingredients | Create formula with ingredients | `test_full_crud_cycle_with_cascade_delete`, `test_operator_can_create_formula` + handshake (created_by/created_at/updated_at) | ✅ COMPLIANT |
| formulas: Formula CRUD with Nested Ingredients | Cascade delete | `test_full_crud_cycle_with_cascade_delete` + handshake (DB ing count 0) | ✅ COMPLIANT |
| formulas: Ingredient Fields | Invalid unit | `test_invalid_unit_returns_422` + handshake | ✅ COMPLIANT |
| formulas: Ingredient Fields | Invalid quantity | `test_invalid_quantity_returns_422` + handshake | ✅ COMPLIANT |
| formulas: Automatic Unit Conversion | Kilogram to grams | `test_kg_to_grams_conversion` + handshake (quantity_g==1000, unit/quantity preserved) | ✅ COMPLIANT |
| formulas: Automatic Unit Conversion | Sub-gram precision | `test_sub_gram_precision_conversion` + handshake (0.001kg → 1g, Decimal) | ✅ COMPLIANT |
| formulas: Formula to Pantone Link | Valid reference | `test_formula_to_pantone_link_valid` + handshake (pantone_color_id matches) | ✅ COMPLIANT |
| formulas: Formula to Pantone Link | Nonexistent reference | `test_formula_to_pantone_link_nonexistent_rejected` + handshake (404/422) | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant in the slice D assessment universe; 0 UNTESTED (every assessed scenario has a passing committed covering test, independently re-run); 0 FAILING.

**Cross-cutting (auth/base expectations, proven end-to-end, not in slice D counts)**: 401 on unauthenticated access to all four pantone/formulas routes; authed-not-admin-only role model (operator can write pantone + formulas); audit rows on every write with none on reads.

### Correctness (Static Evidence)
| Feature | Status | Notes |
|---------|--------|-------|
| Single conversion point `quantity_g` | ✅ Implemented | `formulas/schemas.py:IngredientOut._compute_quantity_g` — `q * 1000 if unit=='kg' else q`, Decimal, no FP loss; matches design "single conversion point `formulas/schemas.py:IngredientOut`" line-for-line |
| Original unit/quantity preserved | ✅ Implemented | `IngredientOut` exposes `quantity`, `unit` alongside `quantity_g` (design: "original unit preserved") |
| `?q=` prefix + case-insensitive search | ✅ Implemented | `pantone_colors/router.py:list_pantone_colors` — `code.ilike(q + "%")` on the indexed `code` column; empty list when `q` matches nothing |
| Duplicate code → 409 not persisted | ✅ Implemented | `UNIQUE(code)` at schema; router catches `IntegrityError` → 409 + `db.rollback()` (duplicate not persisted) |
| Default gamut `'C'` | ✅ Implemented | `gamut` `default="C"` + `server_default="C"` in `PantoneColor`; schema default `"C"` |
| paint_type enum validation (422) | ✅ Implemented | `PantoneColorCreate.paint_type: PaintType` (reactiva/pigmento) → pydantic 422 |
| Nested ingredients CRUD | ✅ Implemented | `FormulaOut` nests `list[IngredientOut]`; create/update replace ingredients; ORM `delete-orphan` |
| Cascade delete | ✅ Implemented | `formula_ingredients.formula_id` `ondelete=CASCADE` (DB) + relationship `cascade="all, delete-orphan"` (ORM); prove → 0 ingredients after delete |
| `created_by`/`created_at`/`updated_at` | ✅ Implemented | `formulas/models.py:Formula`; `created_by` = acting user id; timestamps via `utcnow()` (+ `onupdate` for `updated_at`) |
| Formula→Pantone FK link validation | ✅ Implemented | `_ensure_pantone_exists` in `formulas/router.py:create_formula` → 404 when the referenced pantone id is absent |
| `quantity` Decimal, no FP loss | ✅ Implemented | `Numeric(10,4)` storage (ADR-5) + `Decimal` in schema/`IngredientOut` |
| Audit on every write, none on reads | ✅ Implemented | `log_action(db, user.id, "<resource>.<verb>")` in create/update/delete handlers (same tx); read handlers never log |
| Routes authed-not-admin-only | ✅ Implemented | `get_current_user` (not `require_roles`) on every pantone/formulas route — operator CAN, unauth 401 |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Single conversion point `quantity_g` at `IngredientOut` | ✅ Yes | Matches design line exactly; the only conversion code in the codebase |
| API surface codes (`?q=`, 409 dup, 422 bad values, 404 missing, CRUD) | ✅ Yes | All exercised at runtime in the handshake |
| Roles: pantone/formulas authed (admin OR operator), not admin-only | ✅ Yes | `get_current_user` only (no `require_roles`); operator CRUD proven end-to-end |
| Decimal storage (ADR-5) | ✅ Yes | `Numeric(10,4)` + pydantic `Decimal`; 0.001kg→1g proven with no FP loss |
| Enum units `g`/`kg` (ADR-4) + normalize to grams | ✅ Yes | `Unit` enum; `quantity_g` computed in `IngredientOut` |
| Module layout (schemas/router per module) | ✅ Yes | `pantone_colors/{schemas,router}.py`, `formulas/{schemas,router}.py` |
| Audit `log_action` shared helper | ✅ Yes | Reused from slice C `access_logs/service.py` |
| Formula cascade at DB + ORM levels | ✅ Yes | `ondelete=CASCADE` + `delete-orphan`; cascade proven |

### TDD Compliance (Strict TDD module)
| Check | Result | Details |
|-------|--------|--------|
| TDD Evidence reported | ✅ | Slice D apply-progress records the RED/GREEN cycle for 5.1/5.2/6.1/6.2 |
| All tasks have tests | ✅ | 4/4 — 5.1/5.2 driven by `test_pantone_colors.py`; 6.1/6.2 driven by `test_formulas.py` |
| RED confirmed (test files exist) | ✅ | RED commits exist and contain ONLY the test files, before their routers: `4731e28` (only `test_pantone_colors.py`, 185 insertions), `a19c8fe` (only `test_formulas.py`, 235 insertions). Both GREEN routers were added later in `9d442f1`/`dc84176` |
| RED committed before GREEN | ✅ | Verified via `git show --stat`: RED commits touch no router/model/schema file; GREEN commits introduce the routers |
| GREEN confirmed (tests pass) | ✅ | 23/23 slice D tests pass on independent execution (64/64 full suite) |
| Triangulation adequate | ✅ | pantone: 12 tests over the 6 scenarios; formulas: 11 tests over the 8 scenarios; no multi-scenario behavior rests on a single test |
| Safety Net for modified files | ✅ | Both test files are new in the RED commits (N/A legitimate); no modified-file task claims N/A improperly |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 0 | 0 | — |
| Integration | 23 | 2 | pytest + TestClient + temp-file SQLite + real bcrypt/JWT primitives |
| E2E | 51 checks | 1 | independent runtime handshake (real app + seeded DB) |
| **Total (slice D)** | **23 committed** | **2** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`pytest-cov` not installed). Not a failure.

### Assertion Quality
- `test_pantone_colors.py`: asserts real status codes (201/200/200/204/409/422/401/404), DB row effects (duplicate not persisted via count==1; delete row gone via `db.get is None`), `?q=` prefix + case-insensitive result sets, default gamut `C`, and audit action tuples against the acting user id — all execute the production path and assert concrete values.
- `test_formulas.py`: asserts status codes, DB row effects (formula persisted, `created_by==1` for seeded admin, `created_at`/`updated_at` non-null, 2 ingredients, cascade removal via empty ingredient-id set, link `pantone_color_id`), Decimal `quantity_g == 1000`/`== 1` with no FP loss, original unit preserved, invalid unit/quantity 422, and audit action tuples — all real behavior.
- Both suites verify audit via the full audit-row set query (`pantone.create/update/delete`, `formula.create/update/delete`), confirming read-only handlers never log (covered by the handshake negative).
- No tautologies, ghost loops, type-only-only assertions, smoke-only checks, or implementation-detail coupling found.

**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ➖ Not available (no flake8/ruff configured)
**Type Checker**: ➖ Not available (Python; pytest + runtime handshake used as the executable check)
**Coverage**: ➖ Not available (pytest-cov missing)

### Issues Found
**CRITICAL**: None

**WARNING**:
1. `InsecureKeyLengthWarning` (PyJWT, RFC 7518 §3.2): the configured `secret_key` (`dev-secret-change-me`, 20 bytes) is below PyJWT's 32-byte minimum for HS256 and every token encode/decode emits the warning. Carried forward from slice C; tokens sign and verify correctly and `config.py` documents the production override, so this is a hardening follow-up, NOT a slice D blocker. Follow-up: set a ≥32-byte key via env/`.env` and add `InsecureKeyLengthWarning` to the pytest filterwarnings.

**SUGGESTION**:
1. The handshake provisions the operator via the real admin-only `POST /users` API before exercising the operator role on pantone/formulas, since `python -m app.seed` only creates the admin. This is the documented bootstrap path and not a defect, but worth confirming the operator provisioning flow is acceptable for the target LAN production seeding story.
2. `duplicate code on PATCH` returns 409 only when the code collides with an *existing different* row; the update-409 path is covered by `test_duplicate_code_on_update_returns_409`. No gap.
3. Carried from slice A/B/C: StarletteDeprecationWarning (httpx → httpx2) on every pytest run — upstream note; `unique=True, index=True` duplicate auto-index (optional future cleanup).
4. Carried from slice C: the "read-only not logged" audit negative is also proven by the committed `test_write_actions_are_audited` via the audit tuple set, and additionally by the handshake DB-count negative — robust.

### DEFERRED (out of slice D scope — NOT defects)
- formulas/designs cross-resource behaviors owned by slice E (designs CRUD, design 1–7 cardinality), and access-logs for designs.
- Frontend screens and UI language (Spanish labels for pantone/formulas screens) → slice F (Phase 9).
- base: REQ-04 SPA static mount (single-origin) → slice E (task 8.2).
- seed provisioning of operator (only admin seeded) → user-management/admin-UI story, slice F / user-facing ops; not a slice D requirement.

### Verdict
**PASS** — Slice D (tasks 5.1, 5.2, 6.1, 6.2) is complete and proven: focused slice D acceptance 23/23 (exit 0, stdout sha256 `51a77aa8…`); full suite 64/64 (exit 0, stdout sha256 `52fcd07f…`, no regressions vs the slice C 41 baseline); an independent 51/51-check runtime handshake against a freshly migrated+seeded DB proves operator-writable, authed-not-admin-only pantone CRUD (201→200→200→204) with duplicate 409 (not persisted), `?q=` prefix + case-insensitive search and empty-list-200 on no-match, invalid `paint_type` 422, default `gamut=C`, formula CRUD with nested ingredients + `created_by`/`created_at`/`updated_at`, cascade delete (DB counts 0), Decimal `quantity_g` conversion (`1kg→1000`, `0.001kg→1`) with original unit preserved, unit/quantity 422, valid/nonexistent pantone link, audit rows on every write with none on reads, 401 unauthenticated on all four routes, and the OpenAPI surface carrying `/api/v1/pantone-colors*` + `/api/v1/formulas*`. TDD evidence 6/6 with RED commits `4731e28` + `a19c8fe` landing only-test-file before their GREEN routers. One carried, non-blocking WARNING (JWT secret 20B < 32B) is recorded for follow-up; remaining items are SUGGESTIONs or cross-slice deferrals.

### Verification Environment (slice D)
- Workspace: /root/TelaryColor (git branch `feat/pr-d-pantone-formulas`, HEAD `3aa2138` — `docs(sdd): record slice D pantone+formulas apply progress`)
- Slice D candidate tree: `git rev-parse HEAD^{tree}` = `2d902ff16a887c1524affc06fc549dec6f98a43e`; envelope `evidence_revision` = sha256 of that tree hash string (`21a7784d…`)
- Backend venv: `backend/.venv` (Python 3.13.7)
- Handshake DB: fresh `/tmp/telary_verify_sliced.db` bootstrapped via `alembic upgrade head` (exit 0, output sha256 `f88ce792…`, byte-identical to slices B/C) + `python -m app.seed` (exit 0 → 1 admin); operator provisioned via real `POST /users`
- Commands executed by verifier: `./.venv/bin/python -m pytest -q tests/test_pantone_colors.py tests/test_formulas.py` (exit 0, stdout sha256 `51a77aa8…`), `./.venv/bin/python -m pytest -q` (exit 0, stdout sha256 `52fcd07f…`), `PYTHONPATH=/root/TelaryColor/backend DATABASE_URL=sqlite:////tmp/telary_verify_sliced.db ./.venv/bin/python /tmp/telary_sliced_handshake.py` (exit 0, 51/51, stdout sha256 `17c8d0b5…`), `alembic upgrade head` fresh DB (exit 0, output sha256 `f88ce792…`), direct SQLite probes
- Evidence hashes: focused stdout `sha256:51a77aa8…`; full-suite stdout `sha256:52fcd07f…`; handshake stdout `sha256:17c8d0b5…`; migration output `sha256:f88ce792…`; evidence revision `sha256:21a7784d…`
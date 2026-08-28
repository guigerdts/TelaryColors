```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:854da29ea53c017325ba3ff9d5f93c6e64b25bd5fe75eb7f68e231c9f9b8f4aa
verdict: pass
blockers: 0
critical_findings: 0
requirements: 32/32
scenarios: 54/54
test_command: cd /root/TelaryColor/frontend && npm test
test_exit_code: 0
test_output_hash: sha256:0949f39571f5dfa7a758719480bd22bdc4f158d306aaeca522900007080bc7fa
build_command: cd /root/TelaryColor/frontend && npm run build
build_exit_code: 0
build_output_hash: sha256:0f45c45a1d5252e653a8243b23a3ee584ce4d165298c61f7a4865cb83bb27921
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
---

## Verification Report — Slice E (Designs + Access Logs + Static SPA Mount)

**Change**: telary-color-mvp-fase1-arquitectura-base
**Slice**: E (tasks 7.1, 7.2, 8.1, 8.2) — Designs CRUD with 1–7 color cardinality + audit; access-logs admin read endpoint + full audit wiring; base REQ-04 single-origin static SPA mount (no CORS).
**Version**: designs spec (current) + access-logs spec (slice E scope) + base spec (REQ-04 Single-Origin Deployment)
**Mode**: Strict TDD
**Date**: 2026-08-28

```yaml
# Slice E verdict (latest assessment — top envelope reflects these counts)
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8227d357292fa8a35717ab4770a2be64151b712cd44c882b9aba9d6f7b8c94b8
verdict: pass
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 16/16
test_exit_code: 0
build_exit_code: 0
```

### Assessment Universe (slice E scope note)

The envelope totals are the requirements/scenarios whose observable behavior ships in tasks 7.1–8.2 and is proven at runtime here: **10 requirements / 16 scenarios** = designs spec (6 requirements / 11 scenarios, excluding the frontend "Minimal Designs Page" requirement) + access-logs spec (3 requirements / 4 scenarios) + base spec REQ-04 "Single-Origin Deployment" (1 scenario). The designs frontend requirement (UI enforces cardinality, task 9.x) is DEFERRED to slice F — a deferral, not a slice E defect. Schema is unchanged since slice B (no migration in this slice), so no data-layer scenarios are re-assessed here.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (slice E) | 4 |
| Tasks complete | 4 |
| Tasks incomplete | 0 |

All slice E tasks (7.1, 7.2, 8.1, 8.2) are marked `[x]` in `tasks.md`. Slice E commits on the branch: `14e71d5` (7.1 RED: `test_designs.py` only, 289 insertions), `a3e6ca9` (7.2 GREEN designs router), `48e01a4` (8.1 RED: `test_access_logs.py` only, 263 insertions), `d83c24d` (8.2 GREEN access-logs router + SPA mount), `ab7bf02` (docs: slice E apply progress). HEAD is `ab7bf02`; working tree clean at verification time. RED-before-GREEN confirmed independently: each RED commit touches ONLY its test file and no router/model/schema file (verified via `git show --stat`), and each GREEN commit lands afterward.

### Build & Tests Execution (independent re-runs, not trusted from apply-progress)

**Build (schema bootstrap)**: ✅ Passed — slice E changes no schema (commit stats for `a3e6ca9`/`d83c24d` touch no model or migration file). The handshake DB was bootstrapped on the documented path:
```text
cd /root/TelaryColor/backend && DATABASE_URL=sqlite:////tmp/telary_verify_slicee.db ./.venv/bin/python -m alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial, create all seven domain tables
exit 0 — output sha256:f88ce792… (byte-identical to slices B, C, and D — single migration unchanged)
```
`python -m app.seed` (same env) exit 0 → exactly 1 user (`admin` / role `admin`), 0 `access_logs` rows (probed). Operator provisioned later through the real admin-only `POST /users` API, matching the documented bootstrap path.

**Focused tests (slice E acceptance)**: ✅ 24 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest -q tests/test_designs.py tests/test_access_logs.py
24 passed, 74 warnings in 42.23s
exit 0 — stdout sha256:7124d9f71d2bbc05ad8657ac20e699aa2ffd8c0e679bc5e69b1f8577733bee39
```
(15 designs tests + 9 access-logs tests — matches apply-progress exactly.)

**Full suite (regression)**: ✅ 88 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && ./.venv/bin/python -m pytest -q
88 passed, 170 warnings in 135.17s (0:02:15)
exit 0 — stdout sha256:c21d6f88442c5c3bc11a202738fe3ce81e907b88ec4487cf6b5d3bde48d257c7
```
88/88 matches the apply-progress claim and the slice D baseline + 24 new slice E tests (64 → 88), with zero regressions. Note: `frontend/dist` exists, so the `_SPARoute` was appended in every test process — the entire 88-test suite already ran with the SPA route active and every `/api/*` test still resolved to the REST tree.

**Runtime handshake (independent, real stack, seeded DB)**: ✅ 75/75 checks passed
```text
PYTHONPATH=/root/TelaryColor/backend DATABASE_URL=sqlite:////tmp/telary_verify_slicee.db ./.venv/bin/python /tmp/telary_slicee_handshake.py
RESULT: 75/75 checks passed — ALL CHECKS PASSED — exit 0 — stdout sha256:6ea2a7e6b551d63baab783a60f7e73987380df7600dc2696f423903e0738dba5
```
The handshake ran the unmodified application (no dependency overrides, no fixtures) against a freshly migrated+seeded temp DB, exercising the real OAuth2 form → bcrypt → JWT → DI → SQLite path. Key proven behaviors:
- **Roles**: admin creates a 1-color design (201) and operator creates a 7-color design (201); both list/read/update (200) and delete (204); unauthenticated → 401 on all five design routes (GET/POST list+create, GET/PATCH/DELETE id). `created_by`/`created_at`/`updated_at` persisted.
- **Duplicate name**: create → 409 with `"Ya existe un diseño con ese nombre"`, NOT persisted (DB row-count by name == 1); update rename onto an existing name → 409 with the same Spanish detail.
- **Validation**: invalid `paint_type=esmalte` → 422; 0 colors → 422 Spanish `"entre 1 y 7"`; 8 distinct colors → 422 Spanish; exactly 1 and exactly 7 accepted (boundaries); update paths also proven (PATCH with 0 colors → 422 Spanish, 8 entries → 422 Spanish, duplicate color → 409) and rejected updates leave the design untouched.
- **Duplicate color**: same color twice in one design → 409 `"El diseño no puede repetir el mismo color"`, NOT persisted.
- **Cascade + audit**: deleting a design removes its `design_colors` rows (DB probe) and writes a `design.delete` audit row.
- **Access-logs**: admin → 200 (timestamp-desc ordering), operator → 403, unauth → 401. Login (admin + operator) writes `login` audit rows; every mutation (`user.create`, `design.create/update/delete`) audited; repeated reads (incl. the audit endpoint itself) add no rows.
- **Immutability**: the operator's historical `design.create` audit row `(user_id, timestamp, action)` is byte-identical after an admin updates the operator's profile.
- **REQ-04 single-origin**: `GET /` → 200 `text/html` serving the built `index.html`; `GET /api/v1/designs/{id}` still returns JSON (API not shadowed); `GET /openapi.json` 200; `OPTIONS /api/v1/designs` (with a foreign `Origin` + `Access-Control-Request-Method`) → 405 with no `access-control-allow-origin`/`access-control-allow-methods` headers (no CORS, ADR-2); an `/api/v1/` route registered AFTER `create_app()` still resolves (200) — the exact regression a root `Mount("/")` caused is not present.
- **OpenAPI**: `/api/v1/designs`, `/api/v1/designs/{design_id}`, `/api/v1/access-logs` all present; the SPA catch-all is excluded from the schema (`include_in_schema=False`).

**Coverage**: ➖ Not available — `pytest-cov` not installed. Reported, not a failure.

### Spec Compliance Matrix (slice E assessment universe)
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| designs: Design Fields | Create a design | `test_designs.py > test_create_design_persists_fields` + handshake (created_by/created_at/updated_at, nested colors) | ✅ COMPLIANT |
| designs: Design Fields | Duplicate name | `test_designs.py > test_duplicate_name_on_create_returns_409`, `test_duplicate_name_on_update_returns_409` + handshake (not persisted) | ✅ COMPLIANT |
| designs: Design Fields | Invalid paint type | `test_designs.py > test_invalid_paint_type_returns_422` + handshake | ✅ COMPLIANT |
| designs: Color Cardinality (1–7) | No colors | `test_designs.py > test_zero_colors_returns_422_spanish` + handshake (create and update paths) | ✅ COMPLIANT |
| designs: Color Cardinality (1–7) | Too many colors | `test_designs.py > test_eight_colors_returns_422_spanish` + handshake (create and update paths) | ✅ COMPLIANT |
| designs: Color Cardinality (1–7) | Boundary accepted | `test_designs.py > test_one_and_seven_colors_accepted_boundary` + handshake (exactly 1 and exactly 7) | ✅ COMPLIANT |
| designs: No Duplicate Color References | Duplicate color | `test_designs.py > test_duplicate_color_reference_rejected` + handshake (create and update → 409, not persisted) | ✅ COMPLIANT |
| designs: Cascade Delete of Link Rows | Delete design | `test_designs.py > test_delete_design_cascades_and_audits` + handshake (DB probe: design_colors empty, `design.delete` row) | ✅ COMPLIANT |
| designs: Authenticated Access (admin or operator) | Operator works with designs | `test_designs.py > test_operator_can_write_designs` + handshake (create/update/delete/list/read as operator) | ✅ COMPLIANT |
| designs: Authenticated Access (admin or operator) | Unauthenticated request | `test_designs.py > test_unauthenticated_returns_401` + handshake (401 on all five routes) | ✅ COMPLIANT |
| designs: Audit All Design Mutations | Mutation logged | `test_designs.py > test_write_actions_are_audited` + handshake (`design.create/update/delete` rows) | ✅ COMPLIANT |
| access-logs: Audit Logging of Data-Mutating Actions | Mutating action logged | `test_access_logs.py > test_mutations_write_audit_rows`, `test_delete_actions_audited_across_resources` + handshake | ✅ COMPLIANT |
| access-logs: Audit Logging of Data-Mutating Actions | Read-only action not logged | `test_access_logs.py > test_read_requests_do_not_write_audit_rows`, `test_history_stable_across_repeated_reads`, `test_read_only_designs_and_formulas_leave_no_rows` + handshake (DB counts) | ✅ COMPLIANT |
| access-logs: Login Auditing | Successful login logged | `test_access_logs.py > test_successful_login_writes_login_row` + handshake (admin + operator login rows) | ✅ COMPLIANT |
| access-logs: Audit Record Integrity | Historical record unchanged | `test_access_logs.py > test_historical_audit_row_unchanged_after_user_update` + handshake (row tuple byte-identical after profile update) | ✅ COMPLIANT |
| base: Single-Origin Deployment (REQ-04) | SPA served from same origin | (no committed pytest — see SUGGESTION 2) + independent runtime handshake: `GET /` → 200 text/html from `frontend/dist`, API NOT shadowed, OPTIONS preflight → 405, zero `access-control-*` headers | ✅ COMPLIANT (runtime handshake evidence) |

**Compliance summary**: 16/16 scenarios compliant in the slice E assessment universe; 0 UNTESTED; 0 FAILING. REQ-04's SPA scenario is proven by the independent 75-check runtime handshake (real execution evidence, not static analysis); the committed-suite gap is a documented SUGGESTION (the mount/ordering/no-CORS behavior is not locked by a committed pytest).

**Cross-cutting (auth/base expectations, proven end-to-end, not inflated into counts)**: 401 unauthenticated and 403-where-admin-only semantics on the new routes; Spanish user-facing `detail` messages on all designs errors; audit rows written in the same transaction as the mutation.

### Correctness (Static Evidence)
| Feature | Status | Notes |
|---------|--------|-------|
| Designs CRUD with admin\|operator roles | ✅ Implemented | `require_roles(Role.admin, Role.operator)` on all five routes (plant-level work per spec — unlike admin-only `/users`) |
| 1–7 cardinality app-level in-tx | ✅ Implemented | `_validate_color_ids` runs inside the request transaction before any flush (design ADR-6 / design-time note — SQLite cannot CHECK a cross-row count); Spanish `"El diseño debe tener entre 1 y 7 colores"` |
| Distinctness of color references | ✅ Implemented | `len(set(color_ids)) != len(color_ids)` → 409 Spanish; DB `UniqueConstraint(design_id, pantone_color_id)` (slice B) as the data-layer backstop |
| Pantone existence check | ✅ Implemented | `db.get(PantoneColor, id) is None` → 404 `"Color Pantone no encontrado"` inside the same tx |
| Duplicate name 409 (create + update) | ✅ Implemented | `_ensure_name_free` with `exclude_id` on update; Spanish `"Ya existe un diseño con ese nombre"`; `designs.name` UNIQUE (slice B) as backstop |
| Update replaces color set | ✅ Implemented | `design.colors = [...]` with ORM `delete-orphan` cascade prunes stale links; `color_ids` absent ⇒ colors preserved (users/formulas partial-update pattern) |
| Cascade delete + audit | ✅ Implemented | `db.delete(design)` cascades via `delete-orphan` + DB `ON DELETE CASCADE`; `design.delete` audit row in the same tx |
| `created_by`/timestamps | ✅ Implemented | `created_by` = acting user id; `created_at`/`updated_at` via `utcnow()` (+ `onupdate`) |
| Access-logs admin-only read | ✅ Implemented | `require_roles(Role.admin)` on `GET /access-logs`; ordered `timestamp desc, id desc` (stable tiebreak — documented deviation, design said newest-first). Endpoint never logs (spec read-only negative) |
| Audit wiring across all resources | ✅ Implemented | `log_action` shared helper (slice C) now used by designs router too; auth/users/pantone/formulas/designs all audit in the same tx as their mutation |
| Audit immutability | ✅ Implemented | `access_logs.user_id → users` NO ACTION FK (slice B); rows store `user_id` + `timestamp` + `action` snapshot; profile update leaves the tuple byte-identical |
| `_SPARoute` ordering-sensitive shape | ✅ Works as designed (bounded risk — WARNING 2) | custom `Route` yields `Match.NONE` for non-HTTP scopes and `/api/*` paths so the REST tree always wins; appended LAST in `create_app()`; `include_in_schema=False`. Proven at runtime incl. a late-registered `/api/v1/` route. Risk: any future NON-API route appended after `_mount_spa` would be shadowed (Starlette first-match) — see WARNING 2 |
| No CORS | ✅ Implemented | no `CORSMiddleware` in the codebase or middleware stack; preflight → 405 with zero `access-control-*` headers (runtime) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| ADR-6: 1–7 cardinality app-level in tx + DB unique pair | ✅ Yes | `_validate_color_ids` in the request transaction; `uq_design_color` at the data layer; UI-side disable is slice F |
| Design Time Note (cardinality enforcement) | ✅ Yes | Spanish 422 for 0/>7; boundary 1 & 7 accepted; duplicate color rejected (409 — spec allows reject-or-collapse; the implementation rejects) |
| API surface: `POST /designs` `GET/PATCH/DELETE /designs/{id}` admin\|operator, codes 201/200/422/409/404 | ✅ Yes | All codes exercised at runtime; delete 204 (spec/design-consistent with the other CRUD modules) |
| `GET /access-logs` admin-only (design API surface) | ✅ Yes | `require_roles(Role.admin)`; confirmed 200/403/401 |
| Single-origin static SPA at `/`, no CORS (ADR-2 / REQ-04) | ✅ Yes | `_SPARoute` serves `frontend/dist` at `/` when present; no CORS; REST under `/api/v1` never shadowed |
| Audit every design mutation + login in same tx | ✅ Yes | `log_action` before `commit` in create/update/delete and login; design "Sequence: Design create" matches |
| Cardinality at router (not schema) | ⚠️ Deviation (documented) | `DesignCreate.color_ids` has no `min_length=1/max_length=7` Field — a schema-level rejection would return Pydantic's English error and never reach the spec-required Spanish message; ADR-6 explicitly places the check at the application layer. Exactly the documented deviation; no spec break |
| SPA via custom `Route` instead of `Mount("/")` | ⚠️ Deviation (documented, evaluated) | A root mount matches every path and shadowed test_auth's late-registered `/api/v1/_probe` route (real regression). `_SPARoute` fixes it; behavior per REQ-04/ADR-2. Risk evaluated in WARNING 2 |
| `DesignOut` nests `colors: [{id, pantone_color_id}]` | ⚠️ Deviation (additive) | create/update still take flat `color_ids`; nested output mirrors `FormulaOut.ingredients`; spec-compatible |
| Access-logs ordering `timestamp desc, id desc` | ⚠️ Deviation (additive tiebreak) | spec requires newest-first; `id desc` only stabilizes same-tick rows |

### TDD Compliance (Strict TDD module)
| Check | Result | Details |
|-------|--------|--------|
| TDD Evidence reported | ✅ | Slice E apply-progress records the RED/GREEN cycle for 7.1/7.2/8.1/8.2 (table + per-task notes) |
| All tasks have tests | ✅ | 4/4 — 7.1/7.2 driven by `test_designs.py`; 8.1/8.2 driven by `test_access_logs.py` |
| RED confirmed (test files exist) | ✅ | RED commits exist and contain ONLY the test files, before their routers: `14e71d5` (only `test_designs.py`, 289 insertions), `48e01a4` (only `test_access_logs.py`, 263 insertions). GREEN routers landed later in `a3e6ca9`/`d83c24d` |
| RED committed before GREEN | ✅ | Verified via `git show --stat` per commit: RED commits touch no router/model/schema file |
| GREEN confirmed (tests pass) | ✅ | 24/24 slice E tests pass on independent execution (88/88 full suite) |
| Triangulation adequate | ✅ | designs: 15 tests over 11 scenarios, both boundary values (1 AND 7) asserted with DIFFERENT expected outcomes, Spanish-detail asserts, DB not-persisted probes, update + create paths; access-logs: 9 tests over 4 scenarios incl. direct-DB negatives and the immutability tuple compare — no multi-scenario behavior rests on a single test |
| Safety Net for modified files | ✅ | Both test files are new in the RED commits (N/A legitimate); the table's pre-baseline claims (64 passed / 79 passed) are consistent with the verified suite history |

**TDD Compliance**: 6/6 checks passed. One documented TDD note (not a failure): the 7.1 RED file received a post-GREEN strengthening (nonexistent-pantone asserted as 404 + Spanish detail instead of the lax `in (404, 422)`), fixup-squashed into the RED commit and recorded in apply-progress — the committed RED file is the strengthened version, which is the contract that was then enforced.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 0 | 0 | — |
| Integration | 24 | 2 | pytest + TestClient + temp-file SQLite + real bcrypt/JWT primitives |
| E2E | 75 checks | 1 | independent runtime handshake (real app + seeded DB, SPA mount active) |
| **Total (slice E)** | **24 committed** | **2** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`pytest-cov` not installed). Not a failure.

### Assertion Quality
- `test_designs.py`: asserts real status codes (201/200/204/409/422/404/401), DB row effects (created design via ORM with `created_by==1`, timestamps non-null, design deleted ⇒ `None`, `design_colors` rows `== []` after cascade), Spanish `detail` strings (`"entre 1 y 7"`, `"Color Pantone no encontrado"`), duplicate-create NOT persisted via DB count, boundary 1 & 7 with different expected lengths (1 vs 7), operator writes verified down to `db.scalar(sa.select(Design)) is None` after operator delete, audit tuples `("design.<verb>", admin_id)` — all execute the production path and assert concrete values.
- `test_access_logs.py`: asserts status codes (200/403/401), ordering (timestamps sorted desc + `id desc` tiebreak), the full audit action set across login/user/pantone/formula/design mutations, login row with non-null timestamp, reads-not-logged via DB count before/after over every read flavor (incl. the audit endpoint), history stable over 5 repeated reads, immutability as the exact `(user_id, timestamp, action)` tuple comparison, and a direct-DB negative proving reads materialize no audit rows — all real behavior.
- Both suites use the real TestClient + real SQLite; the `auth_headers` token factory (slice C) is the only shortcut and is itself real-JWT against the app secret, with the login path fully covered by `test_auth.py` (slice C) and re-proven by the handshake.
- No tautologies, ghost loops, type-only-only assertions, smoke-only checks, or implementation-detail coupling found. Mock ratio: zero mocks in both files.

**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ➖ Not available (no flake8/ruff configured)
**Type Checker**: ➖ Not available (Python; pytest + runtime handshake used as the executable check)
**Coverage**: ➖ Not available (pytest-cov missing)

### Issues Found
**CRITICAL**: None

**WARNING**:
1. `InsecureKeyLengthWarning` (PyJWT, RFC 7518 §3.2): the configured `secret_key` (`dev-secret-change-me`, 20 bytes) is below PyJWT's 32-byte minimum for HS256 and every token encode/decode emits the warning. Carried forward from slices C/D unchanged; tokens sign and verify correctly and `config.py` documents the production override, so this is a hardening follow-up, NOT a slice E blocker. Follow-up: set a ≥32-byte key via env/`.env` and add `InsecureKeyLengthWarning` to the pytest filterwarnings.
2. **`_SPARoute` ordering-sensitive shape (evaluated as bounded risk)**: the SPA route yields `Match.NONE` for non-HTTP scopes and `/api/*` paths, which protects the REST tree (proven: full suite 88/88 runs with the SPA route active; handshake proves a route registered AFTER `create_app()` under `/api/v1/` still resolves). The residual risk is symmetrical: because the route is appended last, any future NON-API route appended after `_mount_spa()` (e.g., a test registering `/healthz` or a marketing page) would be silently shadowed by the SPA catch-all. This is a maintenance trap rather than a current defect — production `create_app()` never adds routes after the mount. Recommended follow-up: document the invariant in `main.py` (comment added in-slice) and/or add a committed pytest asserting `GET /` serves the SPA and late `/api/` routes resolve, locking the ordering behavior (see SUGGESTION 2).

**SUGGESTION**:
1. Apply-progress TDD-table RED hashes (`5ca3bfa` for 7.1, `26d1ece` for 8.1) differ from the actual committed RED hashes (`14e71d5`, `48e01a4`). The intermediate commits exist but were rewritten by the documented `--fixup`/`--autosquash` rebase; the final RED commits are verified (only-test-file, before GREEN). Cosmetic doc drift — worth correcting in the apply-progress record for future readers.
2. REQ-04's SPA mount / no-CORS / non-shadowing behavior has NO committed pytest — the 88-test suite would not catch a regression that breaks `GET /` or re-introduces CORS. Recommended: add a `test_boot.py` (or standalone `test_spa_mount.py`) case asserting `GET /` → 200 text/html when `frontend/dist` exists, `OPTIONS /api/v1/…` → 405 with zero `access-control-*` headers, and a late-registered `/api/v1/` route still resolving. (The handshake proves the behavior today; a committed test would lock it.)
3. `test_zero_colors_returns_422_spanish` / `test_eight_colors_returns_422_spanish` assert `status_code in (400, 422)` (spec allows either) plus the Spanish detail — the implemented code returns exactly 422, so the asserts could be tightened to `== 422`; harmless as written.
4. The designs update-path cardinality/duplicate negatives (PATCH with 0 / 8 / duplicated colors) are proven only by the independent handshake, not by a committed pytest; the shared `_validate_color_ids` code path makes the risk low, but a committed case would lock it (mirrors SUGGESTION 2's rationale).
5. Carried from earlier slices: StarletteDeprecationWarning (httpx → httpx2); `unique=True, index=True` duplicate auto-indexes in SQLite (optional future cleanup).

### DEFERRED (out of slice E scope — NOT defects)
- designs: Minimal Designs Page (frontend, Spanish UI, 1–7 picker disabling the 8th color) → slice F (Phase 9, tasks 9.2/9.3); the static mount already serves whatever build exists.
- users: Minimal Admin UI Page → slice F.
- base: PWA manifest/icon scenarios → verified in slice A.
- base: Strict TDD "Frontend red-green" scenario → slice F (vitest).

### Verdict
**PASS** — Slice E (tasks 7.1, 7.2, 8.1, 8.2) is complete and proven: focused slice E acceptance 24/24 (exit 0, stdout sha256 `7124d9f7…`); full suite 88/88 (exit 0, stdout sha256 `c21d6f88…`, zero regressions vs the slice D 64 baseline); an independent 75/75-check runtime handshake against a freshly migrated+seeded DB proves admin AND operator designs CRUD (1-color and 7-color creates, list/read/update/delete), duplicate name 409 on create AND update with the duplicate never persisted, invalid paint_type 422, 0/8 colors → 422 with the Spanish `"entre 1 y 7"` message (create and update paths), boundary 1 & 7 accepted, duplicate color 409 not persisted, cascade delete removing `design_colors` rows with a `design.delete` audit row, admin-only `/access-logs` (200/403/401) with timestamp-desc ordering, login + every mutation audited, reads never logged, audit rows immutable across a referenced profile update, and REQ-04 single-origin: `GET /` serves the built SPA (200 text/html) while `/api/v1/*` stays on the REST tree (late-registered routes included), OPTIONS preflight → 405 with zero `access-control-*` headers (no CORS), and `/openapi.json` carrying `/api/v1/designs*` + `/api/v1/access-logs`. TDD evidence 6/6 with RED commits `14e71d5` + `48e01a4` landing only-test-file before their GREEN routers. Two WARNINGs recorded (carried JWT 20B secret; `_SPARoute` ordering shape evaluated as a bounded, currently-working risk); remaining items are SUGGESTIONs or cross-slice deferrals.

### Verification Environment (slice E)
- Workspace: /root/TelaryColor (git branch `feat/pr-e-designs-audit`, HEAD `ab7bf02` — `docs(sdd): record slice E designs+audit apply progress`)
- Slice E candidate tree: `git rev-parse HEAD^{tree}` = `edd0f69e62ce8ce255b85a1cdec73cfc682a7520`; envelope `evidence_revision` = sha256 of that tree hash string (`8227d357…`)
- Backend venv: `backend/.venv` (Python 3.13.7)
- Handshake DB: fresh `/tmp/telary_verify_slicee.db` bootstrapped via `alembic upgrade head` (exit 0, output sha256 `f88ce792…`, byte-identical to slices B/C/D) + `python -m app.seed` (exit 0 → 1 admin, 0 audit rows); operator provisioned via real `POST /users`
- Commands executed by verifier: `./.venv/bin/python -m pytest -q tests/test_designs.py tests/test_access_logs.py` (exit 0, stdout sha256 `7124d9f7…`), `./.venv/bin/python -m pytest -q` (exit 0, stdout sha256 `c21d6f88…`), `PYTHONPATH=/root/TelaryColor/backend DATABASE_URL=sqlite:////tmp/telary_verify_slicee.db ./.venv/bin/python /tmp/telary_slicee_handshake.py` (exit 0, 75/75, stdout sha256 `6ea2a7e6…`), `alembic upgrade head` fresh DB (exit 0, output sha256 `f88ce792…`), direct SQLite/ORM probes
- Evidence hashes: focused stdout `sha256:7124d9f7…`; full-suite stdout `sha256:c21d6f88…`; handshake stdout `sha256:6ea2a7e6…`; migration output `sha256:f88ce792…`; evidence revision `sha256:8227d357…`

## Verification Report — Slice F (Frontend SPA + Single-Origin Integration)

**Change**: telary-color-mvp-fase1-arquitectura-base
**Slice**: F (tasks 9.1, 9.2, 9.3, 10.1) — Frontend SPA: auth store + API client + route guard (9.1), search/pantone/formulas/designs pages with debounced search and 1–7 color picker (9.2/9.3), single-origin integration with the backend REST tree (10.1).
**Version**: users spec ("Minimal Admin UI Page") + designs spec ("Minimal Designs Page", frontend) + base spec (Strict TDD frontend red-green scenario; REQ-04 re-proven) — auth/pantone/formulas specs' Spanish-UI clauses assessed cross-cutting
**Mode**: Strict TDD
**Date**: 2026-08-28

```yaml
# Slice F verdict (latest assessment — top envelope reflects these counts)
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:854da29ea53c017325ba3ff9d5f93c6e64b25bd5fe75eb7f68e231c9f9b8f4aa
verdict: pass
blockers: 0
critical_findings: 0
requirements: 3/3
scenarios: 3/3
test_exit_code: 0
build_exit_code: 0
```

### Assessment Universe (slice F scope note)

The envelope totals are the requirements/scenarios whose observable behavior ships in tasks 9.1–10.1 and is proven at runtime here: **3 requirements / 3 scenarios** = users spec "Minimal Admin UI Page" (1 scenario) + designs spec "Minimal Designs Page" (1 scenario: UI-enforced 1–7 cardinality) + base spec "Strict TDD" frontend red-green scenario (1 scenario; the backend half was proven in slices A–E). Cross-cutting expectations re-proven but NOT inflated into the counts: base REQ-04 single-origin (the slice F build served at `/`), the auth/pantone/formulas Spanish-UI clauses (every screen renders Spanish labels with English identifiers), and the auth OAuth2-password login flow exercised by the SPA wiring.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (slice F) | 4 |
| Tasks complete | 4 |
| Tasks incomplete | 0 |

All slice F tasks (9.1, 9.2, 9.3, 10.1) are marked `[x]` in `tasks.md`; cumulative change-wide 25/25. Slice F landed as a single work-unit commit `ff3f9fe` (feat(frontend)) after the documented crash recovery; HEAD is `ff3f9fe`, working tree clean at verification time. TDD evidence is recorded in apply-progress (Slice F section, table + per-task notes). Note: the slice F apply-progress docs commit is not among the last 6 commits — the frontend code commit is the authoritative change unit verified here, and the apply-progress file (committed earlier in the sequence) documents the slice's TDD cycle.

### Build & Tests Execution (independent re-runs, not trusted from apply-progress)

**Frontend tests (slice F acceptance)**: ✅ 17 passed, 0 failed, 0 skipped (7 files)
```text
cd /root/TelaryColor/frontend && npm test
Test Files  7 passed (7)
Tests       17 passed (17)
Duration    78.79s (transform 836ms, setup 9.93s, import 1.73s, tests 1.84s, environment 59.77s)
exit 0 — stdout sha256:0949f39571f5dfa7a758719480bd22bdc4f158d306aaeca522900007080bc7fa
```
Distribution: `client.test.js` 4, `store.test.js` 3, `useDebounce.test.js` 3, `ProtectedRoute.test.jsx` 2, `DesignColorPicker.test.jsx` 3, `Search.test.jsx` 1, `App.test.jsx` 1. The suite runs serially (`fileParallelism: false` in vite.config.js — documented deviation); aarch64 jsdom environment setup dominates wall time (59.77s of 78.79s; per-file test time 1.84s).

**Production build**: ✅ Passed
```text
cd /root/TelaryColor/frontend && npm run build
✓ 39 modules transformed.
dist/index.html                 0.57 kB │ gzip: 0.33 kB
dist/assets/index-rBpErd17.css 13.96 kB │ gzip: 3.64 kB
dist/assets/index-Ca9xScJm.js 252.56 kB │ gzip: 77.83 kB
✓ built in 606ms
exit 0 — stdout sha256:0f45c45a1d5252e653a8243b23a3ee584ce4d165298c61f7a4865cb83bb27921
```
`dist/` contains `index.html`, `assets/`, `icons/`, `manifest.webmanifest`.

**Backend regression**: ✅ 88 passed, 0 failed, 0 skipped
```text
cd /root/TelaryColor/backend && .venv/bin/python -m pytest tests/ -q
88 passed, 170 warnings in 86.80s (0:01:26)
exit 0 — stdout sha256:44783da678500774808e50290697cd66eaf5d1cc299e77a5135d52a5f4112c82
```
Zero regressions vs the slices A–E 88-test baseline — the frontend slice does not disturb the backend contract.

**Runtime handshake (independent E2E, task 10.1)**: ✅ 13/13 checks passed
Bootstrap on the documented path (relative `sqlite:///./data/app.db`, so the server MUST run from `backend/`):
```text
cd /root/TelaryColor/backend && rm -f data/app.db* && mkdir -p data
.venv/bin/alembic upgrade head   → exit 0, "Running upgrade -> 0001_initial"
.venv/bin/python -m app.seed     → exit 0 (1 admin)
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Checks (13/13): uvicorn ready; `GET /docs` → 200; login `admin`/`telary-admin` (OAuth2 form) → `access_token` 124 chars, `token_type=bearer`, user `admin` role `admin`; `GET /api/v1/auth/me` with Bearer → 200; `POST /api/v1/pantone-colors {"code":"888C","gamut":"C","paint_type":"reactiva"}` → 201 (id 1); `GET /api/v1/pantone-colors?q=888` → array containing `888C`; `GET /` → 200 serving the freshly built SPA (`dist/index.html`, "Telary Color" title present) — REQ-04 single origin re-proven with the slice F build; the `/api/v1/*` probes above all resolved while the SPA route is active (REST tree unshadowed); server killed; ephemeral `backend/data/app.db*` removed and `data/` empty. stdout sha256 (handshake): `379f97cc…`.

### Spec Compliance Matrix
| Requirement | Scenario | Evidence (runtime-tested) | Status |
|-------------|----------|---------------------------|--------|
| users: Minimal Admin UI Page | Admin manages users in UI (list/create/role-change, Spanish) | Static source inspection: `AdminUsers.jsx` Spanish labels + calls `listUsers`/`createUser`/`updateUser` → the real `/api/v1/users` endpoints; API layer proven at runtime (this slice's login/me handshake + slice C users-CRUD handshake). No committed AdminUsers page test yet (SUGGESTION 1) | ✅ COMPLIANT (source + handshake evidence) |
| designs: Minimal Designs Page (Frontend) | UI enforces cardinality — the 8th color cannot be selected | Committed `DesignColorPicker.test.jsx` (3 cases: 7th selectable at 6 selected, 8th disabled at 7, disabled after live `userEvent` selection) + static wiring `Designs.jsx` → picker with `MAX_DESIGN_COLORS = 7` | ✅ COMPLIANT (committed test) |
| base: Strict TDD | Frontend red-green — SPA behaviors locked by tests | Independent `npm test`: 17/17 pass, 7 files, exit 0 | ✅ COMPLIANT (committed test) |

**Compliance summary**: 3/3 scenarios compliant in the slice F assessment universe; 0 UNTESTED; 0 FAILING. The users-UI scenario is proven by source inspection plus runtime API evidence (same treatment as slice E REQ-04); the committed-suite gap is documented SUGGESTION 1.

**Cross-cutting (proven end-to-end, not inflated into counts)**: REQ-04 single-origin — built SPA served at `/` while `/api/v1/*` resolves (handshake); Spanish user-facing UI text on every screen (auth + pantone + formulas spec clauses) with English code identifiers; OAuth2 password-form login from the SPA (`api/index.js login` → `/api/v1/auth/login`), Bearer attach + 401-clears-token + redirect in `client.js`.

### Correctness (Static Evidence)
| Feature | Status | Notes |
|---------|--------|-------|
| API client bearer attach + JSON | ✅ Implemented | `apiFetch` sets `Authorization: Bearer` from the store and JSON content-type; 401 → `clearToken()` + injected handler (default `window.location.assign('/login')`) |
| Token persistence (ADR-3) | ✅ Implemented | `auth/store.js` localStorage key `telary_color_token`; load/save/clear |
| Route guard | ✅ Implemented | `ProtectedRoute` → `<Navigate to="/login">` without a token; committed tests cover both branches |
| Auth provider + login | ✅ Implemented | `AuthProvider` login/logout/profile state; login posts OAuth2 form-encoded body (auth spec clause) |
| Debounced search (design: 250ms) | ✅ Implemented | `useDebounce` 250ms; `Search.jsx` debounces before the `?q=` query; committed tests assert no-call-before and exactly-one-call-after |
| Designs picker 1–7 (ADR-6 UI side) | ✅ Implemented | `DesignColorPicker` `MAX_DESIGN_COLORS = 7`, disables every unselected color at saturation; committed tests |
| Router shape | ✅ Implemented | `/login` public; `/search`, `/pantone`, `/formulas`, `/designs`, `/usuarios` guarded inside `Layout`; fallback → `/search` |
| Spanish UI / English identifiers | ✅ Implemented | All screens Spanish (Buscar color, Colores Pantone, Fórmulas, Diseños, Usuarios, Iniciar sesión); identifiers English |
| Admin users page | ✅ Implemented | `AdminUsers.jsx` lists users, create form, role-change select, audit section (additive; admin-only data, 403 swallowed gracefully) — additive superset, no spec break |
| Single-origin URLs | ✅ Implemented | Relative `/api/v1/*` paths only (no hardcoded origins); dev proxy `/api` → 127.0.0.1:8000 in vite config; prod served by `_SPARoute` (slice E) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| ADR-3: bearer token in localStorage | ✅ Yes | `store.js` + `client.js` exactly; cleared on 401 |
| ADR-6: UI disables the 8th color | ✅ Yes | `MAX_DESIGN_COLORS = 7` + disabled state; mirrors the backend 422 boundary |
| Design: search debounce 250ms | ✅ Yes | `useDebounce(250)`; test asserts no call at 100ms / one call after 350ms |
| Design: minimal admin users page | ✅ Yes | Single page, Spanish, list/create/role-change via the user-management endpoints |
| Design: guard + redirect to /login | ✅ Yes | `ProtectedRoute`; committed two-branch tests |
| Single work-unit commit (RED+GREEN together) | ⚠️ Deviation (documented) | apply-progress records the crash recovery; RED scenarios authored first, GREEN verified in the same recovery session; the commit graph shows one `feat(frontend)` commit `ff3f9fe` (RED/GREEN not separately committed as in backend slices) — transparency note (TDD table), not a code defect |
| `fileParallelism: false` | ⚠️ Deviation (documented, env necessity) | aarch64 jsdom boot is slow; serial execution keeps the suite green without timeout thrash |
| Audit-log section inside AdminUsers | ⚠️ Deviation (additive) | users spec doesn't require audit display; extra section reads admin-only data; graceful on 403 |

### TDD Compliance (Strict TDD module)
| Check | Result | Details |
|-------|--------|--------|
| TDD Evidence reported | ✅ | apply-progress Slice F section records the TDD cycle for 9.1/9.2/9.3 (table + per-task notes incl. the crash-recovery deviation) |
| All tasks have tests | ✅ | 3/3 — 9.1: store/client/ProtectedRoute tests; 9.2: useDebounce + Search tests; 9.3: DesignColorPicker tests. Task 10.1 (integration) is proven by the runtime handshake, matching the documented acceptance basis |
| RED confirmed (test files exist) | ✅ | All 7 test files exist and contain the described behaviors (verified by inspection before the run) |
| RED committed before GREEN | ⚠️ Note | Single work-unit commit `ff3f9fe` (documented crash recovery in apply-progress); RED-before-GREEN is author-time reported, not separable in the commit graph — mirrors the slice B note (2.3 RED observed but not committed separately) |
| GREEN confirmed (tests pass) | ✅ | Independent `npm test`: 17/17 pass, 7 files, exit 0; `npm run build` exit 0 |
| Triangulation adequate | ✅ | designs scenario: 3 cases with DIFFERENT expected outcomes (7th selectable / 8th disabled / disabled after live click); client: 4 behaviors (URL, header, method, 401-clear) over the fetch mock; debounce: no-call-at-100ms, one-call-after-350ms, reset-on-change — no multi-behavior scenario rests on a single test. Search's 1 committed test covers the spec's single search scenario (debounce + render), matching apply-progress' scenario count of 1 |
| Safety Net for modified files | ✅ | All slice F test files are new in `ff3f9fe` (N/A legitimate) |

**TDD Compliance**: 6/6 checks passed (1 documented note on RED-commit separability, above).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 10 | 3 | vitest + jsdom (client fetch-mocked, store localStorage, useDebounce fake timers) |
| Integration | 7 | 4 | vitest + jsdom + MemoryRouter/userEvent (guard, picker, search render, app shell) |
| E2E | 13 checks | 1 | independent runtime handshake (real app + migrated/seeded DB + built SPA) |
| **Total (slice F)** | **17 committed** | **7** | |

### Changed File Coverage
Coverage analysis skipped — no coverage provider configured (`@vitest/coverage-v8` not installed; no `--coverage` script). Not a failure.

### Assertion Quality
- `client.test.js` (4): asserts request URL `/api/v1/pantone-colors`, exact `Authorization: Bearer jwt-abc` header, method, content-type/JSON body, and 401 → token cleared + handler invoked once — all real `apiFetch` behavior against a fetch mock.
- `store.test.js` (3): physical localStorage key/value assertions for load/save/clear on the production store module.
- `useDebounce.test.js` (3): fake timers — intermediate value at 100ms (< 250ms ⇒ not yet debounced), exactly one call after 350ms, and reset-on-debounce-change; real hook code path.
- `ProtectedRoute.test.jsx` (2): real render under `MemoryRouter` — positive branch renders the child, negative branch redirects to `/login` with the protected content absent.
- `DesignColorPicker.test.jsx` (3): `userEvent`-driven — 7th color selectable at initial 6, 8th color disabled at initial 7, disabled after a live click saturates — three distinct expected outcomes over the real picker.
- `Search.test.jsx` (1): fetch-mocked — no request at 100ms, exactly one request with `?q=221` after 350ms, result rendered.
- `App.test.jsx` (1): asserts the SPA shell heading renders through the real router.
- No tautologies, ghost loops, type-only-only assertions, smoke-only checks, or implementation-detail coupling found. Mocks: `fetch` (client/Search), jsdom-native localStorage, fake timers, `userEvent` — the production modules under test execute their real paths.

**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ➖ Not available (no eslint configured in package.json)
**Type Checker**: ➖ Not available (no tsc; `vite build` = esbuild transpile + rollup — catches syntax/import/export errors but does not type-check)
**Coverage**: ➖ Not available (@vitest/coverage-v8 not installed)

### Issues Found
**CRITICAL**: None

**WARNING**:
1. Carried from slice E (unchanged, re-verified this slice): `InsecureKeyLengthWarning` (PyJWT, RFC 7518 §3.2) — configured `secret_key` (20 bytes) below the 32-byte HS256 minimum; tokens sign/verify correctly and `config.py` documents the production override. Follow-up: ≥32-byte key via env/`.env` + filterwarnings entry.
2. Carried from slice E (unchanged, re-verified this slice): `_SPARoute` ordering-sensitive shape — re-proven in the slice F handshake (`GET /` serves the built SPA 200 while all `/api/v1/*` probes resolve). Bounded maintenance risk (future non-API routes appended after the mount would be shadowed), not a current defect.

**SUGGESTION**:
1. No committed vitest renders `AdminUsers.jsx` — the users-UI scenario rests on source inspection + API-handshake evidence. Add a page-level test (render, Spanish heading, create submission → `POST /users` with the form values, role change → `PATCH /users/{id}`) to lock it (mirrors slice E SUGGESTION 2's rationale).
2. Login/Pantone/Formulas/Designs pages lack page-level committed tests (the guard, picker, search page, and API client ARE covered). Page-level tests would lock the Spanish UI + endpoint wiring for the remaining screens.
3. Apply-progress Slice F table counts "Search 2" but the committed `Search.test.jsx` has 1 test; the 17-test total = 16 slice-F tests + 1 slice-A `App.test.jsx`. Cosmetic doc drift worth correcting.
4. The vitest run emits jsdom's "Not implemented: navigation to another Document" notice — expected jsdom limitation (`window.location.assign` is not navigable in jsdom); the redirect is asserted via the injectable unauthorized handler in `client.test.js`. Informational; a `vi.stubGlobal('location', …)` in test-setup would silence it.
5. Carried: StarletteDeprecationWarning (httpx → httpx2); `unique=True, index=True` duplicate auto-indexes in SQLite (optional future cleanup).

### DEFERRED (out of slice F scope — NOT defects)
- base: PWA offline caching / service worker — explicitly NOT part of Fase 1 (verified slice A; no SW by design).
- Nothing else: slice F completes the implementation work units; the remaining SDD phase is archive.

### Verdict
**PASS** — Slice F (tasks 9.1, 9.2, 9.3, 10.1) is complete and proven: frontend acceptance 17/17 (7 files, exit 0, stdout sha256 `0949f395…`, 78.79s); production build exit 0 (39 modules, `dist/` emitted, stdout sha256 `0f45c45a…`); backend regression 88/88 (exit 0, stdout sha256 `44783da6…`, zero regressions vs slices A–E); independent 13/13-check runtime handshake on the documented path (fresh migrate + seed, uvicorn from `backend/` with the relative `sqlite:///./data/app.db`, `/docs` 200, OAuth2 login → bearer JWT, `/auth/me` 200, pantone `888C` create 201 + `?q=888` search hit, `GET /` serving the freshly built SPA with the "Telary Color" title and the REST tree unshadowed — REQ-04 re-proven with the slice F build; ephemeral DB removed). Spec universe 3/3 requirements, 3/3 scenarios (users Admin UI, designs UI-enforced cardinality, base Strict-TDD frontend red-green) with cross-cutting Spanish-UI, single-origin, and login-flow expectations re-proven. TDD evidence 6/6 with one documented note (single work-unit commit after crash recovery — RED-before-GREEN author-time reported, not separately committed). Two carried WARNINGs (JWT 20B secret; `_SPARoute` ordering shape — both re-verified non-blocking); the rest are SUGGESTIONs or cross-slice deferrals.

### Verification Environment (slice F)
- Workspace: /root/TelaryColor (git branch `feat/pr-f-frontend`, HEAD `ff3f9fe` — `feat(frontend): add SPA screens, auth store and API client`; slice E verification docs at `bfd5368`)
- Slice F candidate tree: `git rev-parse HEAD^{tree}` = `12671c22f0e9a9768e8207634f74dec1285581e3`; envelope `evidence_revision` = sha256 of that tree hash string (`854da29e…`)
- Frontend toolchain: node v22.23.1, npm 10.9.8; react 19, react-router-dom 7, vite 8, vitest 4, jsdom 30; `fileParallelism: false` (aarch64 jsdom environment boot ≈ 60s; documented deviation)
- Backend: `backend/.venv` (Python 3.13.7); pytest suite run as `tests/ -q`
- Handshake DB: ephemeral `backend/data/app.db` (relative URL `sqlite:///./data/app.db`) bootstrapped via `alembic upgrade head` (exit 0) + `python -m app.seed` (exit 0 → 1 admin); removed after the run (`data/` empty, uvicorn process verified dead)
- Commands executed by verifier: `cd /root/TelaryColor/frontend && npm test` (exit 0, stdout sha256 `0949f395…`), `cd /root/TelaryColor/frontend && npm run build` (exit 0, stdout sha256 `0f45c45a…`), `cd /root/TelaryColor/backend && .venv/bin/python -m pytest tests/ -q` (exit 0, stdout sha256 `44783da6…`), runtime handshake from `backend/` (13/13, stdout sha256 `379f97cc…`)
- Evidence hashes: test stdout `sha256:0949f395…`; build stdout `sha256:0f45c45a…`; regression stdout `sha256:44783da6…`; handshake stdout `sha256:379f97cc…`; evidence revision `sha256:854da29e…`
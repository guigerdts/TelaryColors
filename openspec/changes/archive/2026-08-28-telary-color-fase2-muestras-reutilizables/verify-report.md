```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:27ee640170e4d2fb974a00566b62f430be142144ea449d2854ca152393f47eb9
verdict: pass
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 17/17
test_command: cd /root/TelaryColor/backend && .venv/bin/pytest -q
test_exit_code: 0
test_output_hash: sha256:5d68c3a019e3087cebc07640a475c6f8a95e243b48d406cb5843f3980dd752f6
build_command: cd /root/TelaryColor/frontend && npm run build
build_exit_code: 0
build_output_hash: sha256:8361d2c9edab28227d61e9ed596fd323ad63e5141dd438cdd67a090196de69c2
```

## Verification Report

**Change**: telary-color-fase2-muestras-reutilizables
**Version**: N/A (delta of samples + base)
**Mode**: Strict TDD (frontend upload fix re-verification)
**Re-verify trigger**: prior report FAILED on one CRITICAL — frontend multipart field `file` vs backend contract `photo` (real UI upload 422). Remediation commit `cbb925f` fixes it; this report re-proves the fix, re-confirms all 17 scenarios, and satisfies the two owner confirmations.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 36 |
| Tasks complete | 36 (`[x]` A1–F6) |
| Tasks incomplete | 0 |
| Requirements | 9/9 (7 samples + 2 base) |
| Scenarios | 17/17 (14 samples + 3 base) |

### Fix Evidence (the CRITICAL that failed the prior gate)

1. **Source**: `frontend/src/api/index.js` L88 of `uploadSamplePhoto` now reads `form.append('photo', file)` (was `'file'`). Verified in commit `cbb925f` diff — exact line changed, nothing else (`--stat`: 2 files, 3 insertions, 2 deletions).
2. **Test assertion**: `frontend/src/api/client.test.js` now asserts `expect(init.body.get('photo')).toBe(file)` (was `'file'`), with a comment binding it to the backend contract (`router.py upload_sample_photo`).
3. **Frontend api client tests**: `cd /root/TelaryColor/frontend && npx vitest run src/api/client.test.js --pool=threads` → **10/10 passed** (exit 0).
4. **End-to-end contract proof** (fresh temp SQLite DB, `Base.metadata.create_all`, seeded `admin`/`telary-admin` via conftest pattern, real OAuth2PasswordRequestForm login via `data=`):
   - `POST /api/v1/auth/login` (form) → 200, token issued.
   - `POST /api/v1/samples/upload` with `files={'photo': ('shot.jpg', JPEG-bytes, 'image/jpeg')}` → **201** `{"photo_url": "/uploads/{uuid}.jpg"}` — server sniffed real JPEG bytes and stored the file. This is exactly what the fixed frontend helper now sends.
   - `POST /api/v1/samples/upload` with `files={'file': ...}` (the old broken contract) → **422** `{'type': 'missing', 'loc': ['body', 'photo'], 'msg': 'Field required', 'input': None}` — the exact failure a real UI upload used to hit. Closed.
   - Harness: `/tmp/opencode/verify_upload_contract.py` (ephemeral, not part of repo).

### Build & Tests Execution
**Build**: ✅ Passed — `npm run build` (frontend dist, exit 0, hash `8361d2c9…`).

**Tests**: ✅ Backend 115 passed (exit 0), Frontend 35 passed (exit 0) — both re-run in full during this verification.

```text
Backend:  .venv/bin/pytest -q        -> 115 passed  (test_samples.py + test_migration.py = 27)
Frontend: npx vitest run --pool=threads -> 35 passed (10 files; client.test.js 10/10)
Full-output hashes (this verification's canonical bytes):
  backend pytest : sha256:5d68c3a019e3087cebc07640a475c6f8a95e243b48d406cb5843f3980dd752f6
  frontend vitest: sha256:88803e3b9ebe44a6e36a340dffda2639f413c2a82c124e5f99cdbcd1fe29532f
  frontend build : sha256:8361d2c9edab28227d61e9ed596fd323ad63e5141dd438cdd67a090196de69c2
  evidence_revision (concatenation): sha256:27ee640170e4d2fb974a00566b62f430be142144ea449d2854ca152393f47eb9
```

**Coverage**: ➖ Not available (no coverage threshold configured on changed files).

### Spec Compliance Matrix (all 17 scenarios)

The remediation commit `cbb925f` touched ONLY `frontend/src/api/index.js` + `frontend/src/api/client.test.js` (verified: `git show --name-only`). It cannot affect any of the 17 scenarios — all are covered by backend tests that this commit does not touch; line anchors re-confirmed by grep at the exact prior positions.

#### Samples spec (14 scenarios)

| Req | Scenario | Test | Result |
|-----|----------|------|--------|
| Sample Data Model | Migration adds table (S1) | `backend/tests/test_samples.py > test_upgrade_head_creates_samples_table_and_indexes` (L69) | ✅ COMPLIANT |
| Sample CRUD w/ Optional Photo | Create without photo (S2) | `test_samples.py > test_create_sample_without_photo_has_null_photo_url` (L310) + `..._photo_url_persists` (L334) | ✅ COMPLIANT |
| Sample CRUD w/ Optional Photo | Photo added later (S3) | `test_samples.py > test_patch_adds_photo_url_later_persisted_and_audited` (L362) | ✅ COMPLIANT |
| Free Audited Status Lifecycle | Audited transition (S4) | `test_samples.py > test_transition_to_descatada_logs_exactly_one_row_same_txn` (L389) | ✅ COMPLIANT |
| Free Audited Status Lifecycle | Any direction (S5) | `test_samples.py > test_all_six_status_transitions_succeed_and_are_audited` (L419) | ✅ COMPLIANT |
| Reusable Listing by Target Pantone | Window capped (S6) | `test_samples.py > test_reusable_listing_capped_at_five_newest_first` (L481) | ✅ COMPLIANT |
| Reusable Listing by Target Pantone | Fewer than five (S7) | `test_samples.py > test_reusable_listing_fewer_than_five_returns_all` (L517) | ✅ COMPLIANT |
| Photo Upload Validation | Crafted type rejected (S8) | `test_samples.py > test_upload_crafted_type_is_rejected_and_nothing_written` (L105) | ✅ COMPLIANT |
| Photo Upload Validation | Oversized file rejected (S9) | `test_samples.py > test_upload_oversized_is_rejected_and_nothing_written` (L123) | ✅ COMPLIANT |
| Photo Upload Validation | Malicious filename rejected (S10) | `test_samples.py > test_upload_with_path_traversal_filename_gets_server_generated_name` (L142) | ✅ COMPLIANT |
| Photo Serving Hardening | No directory listing (S11) | `test_samples.py > test_uploads_root_and_missing_files_are_never_listed_or_served` (L234) | ✅ COMPLIANT |
| Photo Serving Hardening | API never shadowed (S12) | `test_samples.py > test_uploads_never_shadows_api_and_serves_only_stored_files` (L247) | ✅ COMPLIANT |
| Atomic Promote | Happy-path promote (S13) | `test_samples.py > test_promote_happy_path_creates_formula_and_links_sample` (L571) | ✅ COMPLIANT |
| Atomic Promote | Rollback on failure (S14) | `test_samples.py > test_promote_failure_rolls_back_within_transaction` (L617, real in-txn monkeypatched rollback) + `test_promote_empty_ingredients_rejected_and_sample_unchanged` (L659) | ✅ COMPLIANT |

#### Base spec (3 scenarios)

| Req | Scenario | Test | Result |
|-----|----------|------|--------|
| Data Layer | Database available (B1) | `test_db.py` (engine connect + SELECT 1) + `test_boot.py` (app boots SQLite) | ✅ COMPLIANT |
| Single Initial Migration | Fresh upgrade (B2) | `test_migration.py > test_upgrade_head_creates_all_eight_tables` (L55) | ✅ COMPLIANT |
| Single Initial Migration | Already applied (B3) | `test_migration.py > test_upgrade_head_is_idempotent` (L69) | ✅ COMPLIANT |

**Compliance summary**: 17/17 scenarios compliant — every scenario has a committed covering test that passed at runtime in both suite runs of this verification.

### Owner Confirmation #1 — Promote behaviors (EXPLICIT)

- **"Rollback on failure" (S14, samples spec lines 115–119) — among the 17 verified scenarios, PASSES.** The empty-ingredients rollback is covered by `test_promote_empty_ingredients_rejected_and_sample_unchanged` (`backend/tests/test_samples.py` L659) and the true in-transaction rollback by `test_promote_failure_rolls_back_within_transaction` (L617, monkeypatched formula-create failure). Both passed in the full backend suite (115/115). The S14 scenario asserts: no formula persists, no audit event, sample stays `archivada_reutilizable` — both tests prove exactly that.
- **The 409 and 404 behaviors — NOT formal spec scenarios, and must not be blurred with the 17.** The samples spec formalizes only Happy-path promote (S13) and Rollback on failure (S14). The 409 (promote on a non-`archivada_reutilizable` sample) and 404 (promote on a missing sample) are ADR-4 design-guard behaviors implemented in `router.py promote_sample` (design ADR-4 "Atomic promote endpoint", task F3) and verified by dedicated passing tests: `test_promote_non_reusable_sample_returns_409` (L685) and `test_promote_missing_sample_returns_404` (L706), both green in the 115-passed run. Both facts stated: they are NOT among the 17 formal scenarios; they ARE verified by passing dedicated tests.

### Owner Confirmation #2 — Merge standard (EXPLICIT)

- **Stacked branches with RED/GREEN work-unit commits preserved per slice** (verified `git log main..feat/pr-f-promote`, per-slice work units):
  - **Slice A** (PR #14, `feat/pr-a-samples-data`): `99504f6` test-only RED (migration + samples tests) → `811bc46` GREEN (enum, ORM, `0002_samples`, env.py).
  - **Slice B** (PR #16, `feat/pr-b-photo-upload`): `44df29c` test-only RED (S8–S12) → `38e0cf8` GREEN (uploads.py, router, config, main.py, vite proxy).
  - **Slice C** (PR #18, `feat/pr-c-backend-crud`): `79aa0e6` test-only RED (S2–S7) → `89bff24` GREEN (schemas + CRUD router).
  - **Slice D** (PR #20, `feat/pr-d-ficha`): `b20b87d` RED test + GREEN helper (listReusableSamples) → `8a6b062` GREEN composition (Search.jsx + tests).
  - **Slice E** (PR #22, `feat/pr-e-registration`): `a392c83` one work unit with RED tests (`SampleRegistration.test.jsx`, `AppRouter.test.jsx`, `client.test.js` additions) + GREEN flow (`SampleRegistration.jsx`, `api/index.js`, Layout/AppRouter).
  - **Slice F** (PR #24, `feat/pr-f-promote`): `fe8b901` promote endpoint with its RED tests (F1–F3, 170 test lines in `test_samples.py`); `cbb925f` remediation commit (fix field `file`→`photo`) on top of the chain.
  - All six slice branches exist locally and on `origin`; PRs **#14, #16, #18, #20, #22, #24 are OPEN on GitHub, none merged** (verified via `gh pr list`).
- **Final delivery to `main` MUST be a STANDARD merge (merge commit, no squash)** to preserve this RED/GREEN work-unit history — same standard as Fase 1 (Fase 1 main history shows `Merge pull request #3/#4/#6/#8/#10/#12` merge commits). Squash would collapse the 16-commit chain, destroying the RED→GREEN evidence trail per slice that the work-unit commits exist to preserve.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Sample Data Model | ✅ Implemented | Sample ORM + additive `0002_samples`; both indexes |
| Sample CRUD w/ Optional Photo | ✅ Implemented | Backend CRUD/PATCH correct; frontend `uploadSamplePhoto` now sends `photo` — verified end-to-end (201) |
| Free Audited Status Lifecycle | ✅ Implemented | enum, same-txn audit, no DELETE (405) |
| Reusable Listing | ✅ Implemented | cap 5 newest-first |
| Photo Upload Validation | ✅ Implemented | sniff + declared agreement, 413/415/400, uuid4 name |
| Photo Serving Hardening | ✅ Implemented | guarded mount, no listing, `/api/` never shadowed |
| Atomic Promote | ✅ Implemented | one txn, one `sample.promote` row, rollback, 409/404 guards |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| ADR-1 Local FS uploads | ✅ Yes | upload_dir default backend/data/uploads, gitignored |
| ADR-2 Guarded /uploads mount | ✅ Yes | _UploadsRoute + _SPARoute yield NONE for foreign prefixes |
| ADR-3 Sniff + declared agreement, uuid name | ✅ Yes | uploads.py classify_upload |
| ADR-4 Atomic promote endpoint | ✅ Yes | POST /samples/{id}/promote + 409/404 guards |
| ADR-5 Client-side ficha composition | ✅ Yes | Search.jsx + SampleFicha.jsx |
| ADR-6 Immutable target, audit actions, no DELETE | ✅ Yes | PATCH rejects pantone_target_id change (400), audits, 405 on DELETE |

### Issues Found

**CRITICAL**: None. The single prior CRITICAL (multipart field `file` vs `photo`) is closed: source + test assertion + 10/10 frontend client tests + end-to-end 201/422 proof.

**WARNING**:
1. **Strict-TDD evidence is complete for slice F only.** Cumulative apply-progress carries the full RED/GREEN/TRIANGULATE table for F1–F6; slices A–E are documented as checkbox/RED-GREEN prose. All test files exist and pass; the RED/GREEN commit structure is preserved in git history (see Owner Confirmation #2). Non-blocking.
2. **`SampleFicha` "Promover" with no ingredient editor** always sends `ingredients: []` → backend 422 (`min_length=1`). Not a spec failure; documented out-of-scope design note. Non-blocking.

**SUGGESTION**:
1. Add a permanent integration test that runs `uploadSamplePhoto` against the real backend app (or a fixture HTTP multipart post asserting the `photo` field), so the field-name contract is locked by CI rather than by this verification's ephemeral harness.
2. The recommended SUGGESTION from the prior report (integration test closing the field-name gap) is now implemented as the remediation fix + this verification's e2e proof; the permanent test in suggestion 1 would make it durable.

### Verdict
**PASS** — The remediation commit `cbb925f` closes the only CRITICAL: the frontend upload helper now sends multipart field `photo`, the client test asserts `init.body.get('photo')` (10/10), and the exact contract is proven end-to-end (field `photo` → 201 + `photo_url`; field `file` → 422 naming `body.photo`). All 17/17 formal scenarios verified with passing committed covering tests, both suites green (backend 115, frontend 35), build green, both owner confirmations stated explicitly. Archive-ready.
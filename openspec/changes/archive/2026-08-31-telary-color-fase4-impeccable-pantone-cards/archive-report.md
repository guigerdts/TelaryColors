# Archive Report — telary-color-fase4-impeccable-pantone-cards

**Archived**: 2026-08-31
**From**: `openspec/changes/telary-color-fase4-impeccable-pantone-cards/`
**To**: `openspec/changes/archive/2026-08-31-telary-color-fase4-impeccable-pantone-cards/`
**Artifact store**: openspec (+ Engram)
**Status**: SUCCESS — SDD cycle complete (intentional-with-warnings: documentary warnings only)

> This archive is a **worktree-only** operation. All `openspec/` artifacts
> (including this archived folder and the synced main specs) remain
> **untracked** — deliberately out of git history, matching the Fase 3
> convention. No `git add/commit/push` was performed by this phase.

## Gates (checked before archive)

| Gate | Result |
|------|--------|
| Native Review Receipt Gate | PASS — `reviewGate` structurally absent in the archive launch status (no review ever started for this candidate; kill switch off → receipt-driven development does not exist here). Archived under ordinary repository policy. |
| Task Completion Gate | PASS — archived `tasks.md` **39/39 `[x]`**, zero unchecked. Note: launch prompt and verify-report both said "37" but the actual enumeration sums to 39 (A.1–A.5, B.1–B.5, C.1–C.6, D.1–D.9, E.1–E.7, F.1–F.7); 37 was a miscount, not a missing task. Slice F (F.1–F.7) was reconciled to `[x]` by the orchestrator BEFORE this archive (see final-state facts). |
| CRITICAL gate | PASS — `verify-report.md` envelope `gentle-ai.verify-result/v1` (dispatcher-validated, `valid: true`): `verdict: pass_with_warnings`, `critical_findings: 0`, `blockers: 0`. |
| Action Context Guard | PASS — no `workspace-planning` actionContext reported; all archive operations confined to `/root/TelaryColor`. |

## Mechanical Copy Readback

All artifact copies/moves were performed with native shell commands — never
model Read→Write. Mandatory `diff -r` readbacks, all EMPTY (byte-identical,
exit 0):

1. **New main specs (delta IS the full spec)** — `openspec/specs/formula-designs/spec.md`
   and `openspec/specs/pantone-card/spec.md`: `cp` to temp → `diff -r` empty
   (exit 0) → `mv`. Byte-identical to the deltas.
2. **Change folder move** — recursive pre-move snapshot → fallback `mv`
   (`git mv` rejected: folder untracked) → archived. Mandatory `diff -r`
   between the pre-move recursive snapshot and the archived folder is EMPTY,
   exit 0; source directory confirmed gone. Plain `mv` was the correct
   mechanical mechanism for untracked files, by design.

Verbatim readback outputs are in the phase result (empty output = passing).

## Spec Sync (delta specs → main specs)

| Domain | Action | Details |
|--------|--------|---------|
| base | Updated (delta merged) | 3 ADDED requirements appended: Shared Theme with Brand Accent 281C (2 scenarios), Impeccable Retrofit of Existing Screens (2), Strict TDD Applies to UI Retrofit (1). Main spec now 9 requirements / 20 scenarios. All pre-existing requirements preserved. |
| designs | Updated (delta merged) | 1 MODIFIED in place: Design Fields (description extended with optional `client`/`notes`, `(Previously:)` note appended; scenarios unchanged). 2 ADDED appended after it: Client Field (optional), Notes Field (optional) — 2 scenarios each. Main spec now 9 requirements / 18 scenarios; Color Cardinality, duplicates, cascade, auth, audit, and Minimal Designs Page preserved. |
| formula-designs | Created (new main spec) | Main spec did not exist → delta IS the full spec. Mechanical copy: 6 requirements / 10 scenarios. `openspec/specs/formula-designs/spec.md`. |
| inventory | Updated (delta merged) | 2 MODIFIED in place: Inventory Data Model (adds nullable `design_id` FK + `0004_designs` mention, `(Previously:)` note) and Atomic Stock Transaction → **renamed** to Atomic Stock Transaction With Auto Design Link (description extended with the auto-upsert of `formula_designs(source=auto)`; scenario "Automatic link from tagged consumption" added; rollback scenario extended to include the `formula_designs` row). 1 ADDED appended: Design Reference on Consumption Transactions (2 scenarios), inserted before Delivery Notes. Main spec now 8 requirements / 21 scenarios. No REMOVED requirements. |
| pantone-card | Created (new main spec) | Main spec did not exist → delta IS the full spec. Mechanical copy: 4 requirements / 8 scenarios. `openspec/specs/pantone-card/spec.md`. |
| samples | Updated (delta merged) | 1 ADDED appended: Samples Screens Participate in Retrofit (2 scenarios). Main spec now 8 requirements / 19 scenarios; lifecycle/photo/promote contracts preserved. |

No destructive merges (zero REMOVED requirements, all MODIFIEDs carry explicit
`(Previously:)` notes) → no archive-confirmation warning per `config.yaml
rules.archive`.

Current source of truth (new/updated domain specs):
`openspec/specs/{base,designs,formula-designs,inventory,pantone-card,samples}/spec.md`.

## Final-State Facts (recorded at close)

- **Delivery**: Fase 4 complete and CLOSED — the 9-PR chain is MERGED in `main`
  @ `d18c4264f590411ae1eadb6fda4979d1f9244d2c`:

  | PR | Slice | Content | State |
  |----|-------|---------|-------|
  | #40 | A | Impeccable audit baseline (`impeccable-audit-baseline.md`) | MERGED |
  | #42 | B | Visual retrofit + 281C accent token `#00205B` | MERGED |
  | #44 | C1 | Migration `0004_designs` (additive) + `EXPECTED_TABLES` | MERGED |
  | #45 | C2 | `FormulaDesign` model + `Design.client`/`notes` + `design_id` | MERGED |
  | #46 | D1 | Manual design link + client/notes CRUD (router `formula_designs`) | MERGED |
  | #47 | D2 | Atomic auto-upsert + `GET /api/v1/formulas/{id}/detail` | MERGED |
  | #48 | E | Reusable `PantoneCard` + `PantoneDetail` single-call | MERGED (already in main before the chain) |
  | #49 | F1 | Listados PantoneCard + real gamut selector C/TPX/U | MERGED (RED `0d4be6a` → GREEN `5a57ba0`) |
  | #50 | F2 | `design_id` optional + manual link flow | MERGED (RED `9c83c6a` → GREEN `9625e08`) |

- **Tasks at close**: 39/39 complete. Slice F (F.1–F.7) originally remained
  `[ ]` in the persisted artifact while ALL its work was already integrated and
  verified in `main` (PRs #49/#50; RED→GREEN commit pairs visible). The
  orchestrator reconciled those checkboxes to `[x]` BEFORE this archive —
  explicit stale-checkbox reconciliation at orchestrator level, backed by the
  integrated-tree evidence above; not a silent archive-time overwrite.
  Archived `tasks.md` therefore shows 39/39 with zero stale unchecked tasks.
- **Verification (full chain, at close)**: verdict `pass_with_warnings` —
  backend pytest **162 passed** (exit 0), frontend vitest **82 passed / 18
  files** (exit 0), vite build OK (exit 0); requirements 20/20, scenarios
  36/36; 0 CRITICAL.
- **Hashes (real, from the executed verification)**:
  - `test_output_hash` = sha256:`cdf3fc4aecc13521025773cd354b3fdd65183511135a9337f3a636e632d4a0eb`
  - `build_output_hash` = sha256:`e7487fba211a4696ea89a2b8b1a1f6b204bf337cbef016db35a5ef463cd4ebe5`
- **5 mandatory scenarios confirmed in the integrated context**: (1) UNIQUE
  `formula_id,design_id` + idempotent upsert without IntegrityError; (2) detail
  dedup (auto + manual → once, SELECT DISTINCT); (3) atomic rollback of the
  upsert inside `register_transaction`; (4) gamut selector C/TPX/U with no free
  input (`gamut.js` `isValidGamut`); (5) 281C accent only as accent, never
  dominant background (`bg-accent-281c` confined to buttons/nav/swatch/washes).

## Warnings / Notes

1. **verify-report WARNING (resolved before close)** — "tasks.md desactualizado
   para Slice F" (F.1–F.7 `[ ]` at verification time): stale at that snapshot;
   resolved by the orchestrator's pre-archive checkbox reconciliation. Final
   state: 39/39 `[x]`. The verify-report's "30 checked / 7 unchecked" numbers
   were true at verify time, not at close.
2. **verify-report WARNING (documentary gap, unclosed)** — no `apply-progress`
   artifact persisted (3 searches fruitless); TDD evidence is reconstructed
   from the RED→GREEN commit pairs per slice listed above. Process/documentation
   gap only; the integrated tree plus the 162+82 suite pass prove GREEN.
3. **verify-report WARNING (inherent)** — the "Elevate on hover" scenario has
   no automated test by design: the only automatable assert would be a CSS
   class assert, prohibited by Strict TDD; verified visually per the project's
   own protocol (tasks E.7, commit `c9b047b`). Implementation present
   (`PantoneCard.jsx` hover translate + shadow transition). Recorded as
   COMPLIANT by inspection; a behavior-based test strategy is a possible
   improvement, not a blocker.
4. **verify-report SUGGESTIONs (carried, non-blocking)** — `test-setup.js`
   comment vs `vite.config.js` `globals: true` contradiction (no functional
   impact); `evidence_revision` == `test_output_hash` by design (both digest the
   combined test output).
5. **`impeccable-audit-baseline.md` lives at the repo ROOT**
   (`/root/TelaryColor/impeccable-audit-baseline.md`), merged via PR #40 and
   tracked in `main`, NOT inside the change folder. The archived change folder
   contains the SDD artifact trail only (proposal, design, specs, tasks,
   verify-report); the baseline is referenced from the verify-report spec
   matrix. Recorded for traceability; no file was moved out of the repo.
6. **Task-count discrepancy** — launch prompt and verify-report state "37
   tasks" but the persisted artifact enumerates 39 (sum of A.1–A.5, B.1–B.5,
   C.1–C.6, D.1–D.9, E.1–E.7, F.1–F.7). 37 was a miscount; archive records the
   real 39/39.
7. **Merge mechanism** — change folder untracked, so `git mv` was rejected and
   fallback `mv` + snapshot `diff -r` used, per the Mechanical Copy Contract.

## Archived contents (all verified present)

- proposal.md ✅
- specs/base,designs,formula-designs,inventory,pantone-card,samples/spec.md ✅ (6 delta specs)
- design.md ✅
- tasks.md ✅ (39/39 complete, zero unchecked)
- verify-report.md ✅ (`pass_with_warnings`, 0 CRITICAL)
- archive-report.md ✅ (this file, additive-only)

The SDD cycle for this change is complete: planned, implemented, verified, and
archived. Ready for the next change.
# Design: Fase 4 — Impeccable + Tarjetas Pantone + Diseños

## Technical Approach

Extend the existing `Design` model additively (client/notes), add a new `formula_designs` join (formula↔design, `source` auto|manual) beside the existing `design_colors`, tag `inventory_transactions` with an optional `design_id`, and expose a dedicated rich formula detail endpoint (`GET /formulas/{id}/detail`). Frontend: introduce a 281C accent token in the shared Tailwind theme, build the `PantoneCard` component consuming the detail endpoint with an elevating hover, replace legacy flat listings, and retrofit all screens guided by an Impeccable audit — all slices in A→F order under strict TDD (pytest / `npm test`).

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|---|---|---|---|
| D1 | Design extension | Add `client`/`notes` nullable to existing `designs` | Parallel table | Option 1 confirmed; additive, no API/`/designs` break (designs spec) |
| D2 | Formula↔design link | New `formula_designs` with `UNIQUE(formula_id, design_id)` | Reuse `design_colors` | Different dimension (recipe-usage vs color-composition); unique pair guarantees no duplication |
| D3 | Rich ficha | Dedicated `GET /formulas/{id}/detail` | Bloat `FormulaOut` | Avoids coupling legacy list; one call returns formula + deduped designs |
| D4 | Duplicate pair | Idempotent return-existing | 409 conflict | Re-tag is not an error; keeps auto/manual consistent (formula-designs spec) |
| D5 | 281C accent | `#00205B` token in Tailwind v4 theme, accent-only | Full palette rewrite | Avoid "all dark blue" anti-pattern; minimal drift |
| D6 | Auto-upsert location | Inside `register_transaction` atomic txn | Separate request | Same atomic pattern as Fase 3: add+flush→mutate→log→commit, rollback on error |
| D7 | Gamut selector | Real validated options `{C,TPX,U}` | Free text | Spec requires validated options, not text |

## Data Flow

**Auto link (tagged consumption) — one atomic transaction:**
```
POST /inventory/items/{id}/transactions (payload: formula_id, design_id)
   │  validate formula_id & design_id exist (400 otherwise)
   ├─ add Transaction(formula_id, design_id) ─┐
   ├─ item.current_stock += quantity          ├─ single commit
   ├─ upsert formula_designs(formula,design,  │   (rollback all on failure)
   │     source=auto) IF consumo + both IDs  │
   ├─ log_action inventory.transaction       │
   └─ log_action formula_design.create (new pair only) ─┘
```

**Manual link (from ficha):**
```
POST /formulas/{id}/designs {design_id}
   ├─ 404 formula/design missing
   ├─ get-existing (formula_id,design_id) → return existing (idempotent, source unchanged)
   └─ else create formula_designs(source=manual) + log_action formula_design.create → commit
```

**Detail endpoint:**
```
GET /formulas/{id}/detail
   ├─ 404 formula missing
   ├─ formula + ingredients (quantity_g)
   └─ designs = SELECT DISTINCT d.* FROM formula_designs fd
               JOIN designs d ON d.id=fd.design_id WHERE fd.formula_id=?
        (UNIQUE pair ⇒ no dup runs; one design per (formula,design))
```

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/.../impeccable-audit-baseline.md` | Create | Checklist per screen (Formulas/Inventory/Transaction/Alerts/Search/Designs) from `/impeccable audit`; severity P0–P3 + fix/out-of-scope status |
| `backend/alembic/versions/0004_designs.py` | Create | Additive: `ALTER designs ADD client/notes`, `CREATE formula_designs(+UNIQUE)`, `ALTER inventory_transactions ADD design_id` |
| `backend/app/db/enums.py` | Modify | Add `DesignSource(auto/manual)` |
| `backend/app/modules/designs/models.py` | Modify | `client`/`notes` on Design; new `FormulaDesign` model |
| `backend/app/modules/designs/schemas.py` | Modify | `client`/`notes` optional in Create/Update/Out |
| `backend/app/modules/designs/router.py` | Modify | Extend create/update for `client`/`notes` |
| `backend/app/modules/formula_designs/router.py` | Create | Manual link endpoint + shared upsert helper |
| `backend/app/modules/formulas/router.py` | Modify | `GET /{id}/detail` |
| `backend/app/modules/inventory/models.py` + `schemas.py` | Modify | `design_id` column + schema field |
| `backend/app/modules/inventory/router.py` | Modify | `register_transaction` auto-upsert |
| `backend/tests/test_migration.py` | Modify | Add `formula_designs` to `EXPECTED_TABLES` |
| `backend/tests/test_formula_designs.py` | Create | Auto/manual/duplicate/detail/audit-rollback tests |
| `frontend/src/index.css` | Modify | `@theme` 281C accent token |
| `frontend/src/components/PantoneCard.jsx` + `.test.jsx` | Create | Card component + hover + detail fetch |
| `frontend/src/api/index.js` | Modify | `getFormulaDetail`, `linkDesignToFormula` |
| `frontend/src/pages/{Pantone,Search,InventoryTransaction,Designs,Formulas}.jsx` | Modify | Replace listings with PanoneCard; add design_id field; gamut options |

## Interfaces / Contracts

```python
# enums.py
class DesignSource(str, Enum): auto = "auto"; manual = "manual"

# models — FormulaDesign
__tablename__ = "formula_designs"
id; formula_id FK formulas; design_id FK designs;
source: DesignSource; created_at
__table_args__ = UniqueConstraint("formula_id","design_id", name="uq_formula_design")

# formula_designs/router -> POST /formulas/{id}/designs  {design_id} -> 200 FormulaDesignOut
# formulas/router -> GET /formulas/{id}/detail -> FormulaDetailOut
class FormulaDetailOut(FormulaOut):
    designs: list[DesignOut]

# inventory schemas: InventoryTransactionCreate += design_id: int|None = None
# designs schemas: DesignCreate/Update += client: str|None, notes: str|None
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (backend) | `formula_designs` upsert idempotency, unique pair, detail dedup | pytest on router/service |
| Integration | Auto link atomic rollback (monkeypatched audit raises → nothing persists); manual link 404s | pytest `register_transaction` + link endpoint |
| Migration | 0004 additive + downgrade safe; EXPECTED_TABLES | `test_migration.py` expanded |
| Unit (frontend) | PantoneCard render (block/wordmark/code/HEX/formula/designs), empty designs, gamut options | Vitest `npm test` |
| E2E | Retrofit preserves behavior; card fetches detail in one call | Vitest render + api |

## Threat Matrix

`N/A — no runtime shell, subprocess, VCS/PR, executable-file, or process-integration boundary introduced.` New HTTP routes are normal authenticated FastAPI endpoints with Pydantic-validated inputs and FK existence checks following established module patterns (no command injection surface). Impeccable (`audit`/`polish`/`animate`/`critique`) runs as dev-time tooling via `node .../scripts/context.mjs` during sdd-apply, not as product runtime code.

## Migration / Rollout

`0004_designs` additive; `alembic downgrade` drops only new table/columns, Fase 1–3 data intact. Slices shipped as A→F with separate PRs (500-line budget; report real audit forecast for A/B before committing a number).

## Open Questions

- [ ] Reconciliation note: `design_colors` (design's color composition) vs `formula_designs` (design's recipe usage) are distinct dimensions; the card surfaces `formula_designs` — confirm no UI merges them.
- [ ] Confirm whether the manual link from the ficha should offer create-inline or only existing designs (proposal implies existing).

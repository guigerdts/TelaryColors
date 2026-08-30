"""Formula↔design link module (formula-designs spec; design D2/D4/D5).

Owns the ``formula_designs`` relationship between a formula and a design
(``source``: ``manual`` = linked from the formula detail page; ``auto`` =
derived from a tagged ``consumo`` transaction). The UNIQUE
``(formula_id, design_id)`` pair makes re-linking idempotent at the data
layer — the application helper below returns the existing row and never
duplicates it (design D4).
"""
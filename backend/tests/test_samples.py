"""Samples module acceptance tests.

Phase A focuses on the data layer: the additive ``0002_samples`` migration
creates the ``samples`` table plus the ``ix_samples_pantone_target_id`` and
``ix_samples_status`` indexes (samples spec "Sample Data Model", scenario
"Migration adds table"). Later phases add CRUD, upload, and promote tests in
this same file.

Slice B covers photo upload validation (samples spec "Photo Upload
Validation") and serving hardening ("Photo Serving Hardening"): crafted
types are rejected with nothing written, oversized files get 413, a
path-traversal filename never reaches the filesystem (server-generated
``uuid4().hex`` name), ``/uploads`` never lists directories, and ``/api/``
is never shadowed.

Slice C covers backend CRUD + lifecycle (samples spec "Sample CRUD with
Optional Photo" and "Free Audited Status Lifecycle"): create without a
photo keeps ``photo_url`` null, a later PATCH persists and audits a photo
URL, every status transition writes exactly one ``sample.status`` audit row
in the same transaction (any direction), the reusable listing
(``?pantone_target_id=&status=``) returns at most the 5 newest samples, and
DELETE is not routed (405).
"""

import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
import sqlalchemy as sa

from app.core.config import settings
from app.modules.access_logs.models import AccessLog
from app.modules.samples.models import Sample
from app.modules.users.models import User

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _run_alembic(database_url: str, *args: str) -> subprocess.CompletedProcess:
    """Invoke the venv alembic against a caller-provided database file."""
    env = dict(os.environ)
    env["DATABASE_URL"] = database_url
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def _index_names(db_path: str, table: str) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' "
            "AND tbl_name=? AND sql IS NOT NULL",
            (table,),
        ).fetchall()
        return {row[0] for row in rows}
    finally:
        conn.close()


def test_upgrade_head_creates_samples_table_and_indexes(tmp_path) -> None:
    """S1 Migration adds table."""
    db = tmp_path / "app.db"
    result = _run_alembic(f"sqlite:///{db}", "upgrade", "head")

    assert result.returncode == 0, (
        f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}"
    )

    conn = sqlite3.connect(str(db))
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='samples'"
        ).fetchone()
    finally:
        conn.close()

    assert row is not None, "samples table was not created by upgrade head"

    indexes = _index_names(str(db), "samples")
    assert "ix_samples_pantone_target_id" in indexes
    assert "ix_samples_status" in indexes


# --- Slice B: photo upload validation + serving hardening -------------------
#
# Samples spec "Photo Upload Validation" (S8 crafted type, S9 oversized,
# S10 malicious filename) and "Photo Serving Hardening" (S11 no directory
# listing, S12 API never shadowed). Every rejection must leave nothing on
# disk, so each test points the upload directory at a fresh tmp_path.

JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 32
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
WEBP_BYTES = b"RIFF\x10\x00\x00\x00WEBPVP8 " + b"\x00" * 32


def test_upload_crafted_type_is_rejected_and_nothing_written(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """S8 Crafted type rejected: JPEG bytes declaring PNG → 400, no file."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    headers = auth_headers("admin")

    response = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={"photo": ("crafted.png", JPEG_BYTES, "image/png")},
    )

    assert response.status_code == 400
    assert not upload_dir.exists(), "rejected upload must not create the upload dir"


def test_upload_oversized_is_rejected_and_nothing_written(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """S9 Oversized file rejected: bytes over the cap → 413, no file."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    monkeypatch.setattr(settings, "max_upload_bytes", 1024)
    headers = auth_headers("admin")

    response = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={"photo": ("oversized.jpg", JPEG_BYTES[:8] + b"A" * 2048, "image/jpeg")},
    )

    assert response.status_code == 413
    assert not upload_dir.exists(), "oversized upload must not create the upload dir"


def test_upload_with_path_traversal_filename_gets_server_generated_name(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """S10 Malicious filename rejected: uuid4().hex name written in upload_dir."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    headers = auth_headers("admin")

    response = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={"photo": ("../../evil.png", PNG_BYTES, "image/png")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["photo_url"].startswith("/uploads/")
    stored_name = body["photo_url"].removeprefix("/uploads/")
    assert re.fullmatch(r"[0-9a-f]{32}\.png", stored_name), (
        f"expected server-generated uuid4().hex + .png, got {stored_name!r}"
    )
    stored_file = upload_dir / stored_name
    assert stored_file.is_file(), "server-generated file must live inside upload_dir"
    assert stored_file.read_bytes() == PNG_BYTES
    assert not (upload_dir / "evil.png").exists(), "client filename must never be used"


def test_upload_non_allowlisted_declared_type_is_rejected(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """Only JPEG/PNG/WebP are accepted: a declared PDF → 415, no file."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    headers = auth_headers("admin")

    response = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={"photo": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
    )

    assert response.status_code == 415
    assert not upload_dir.exists()


def test_upload_non_image_bytes_claiming_image_are_rejected(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """Threat matrix: SVG/script bytes declared as a JPEG → 400, no file."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    headers = auth_headers("admin")

    response = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={
            "photo": (
                "logo.jpg",
                b"<svg xmlns='http://www.w3.org/2000/svg'>"
                b"<script>alert(1)</script></svg>",
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 400
    assert not upload_dir.exists()


def test_upload_webp_is_accepted_with_server_generated_name(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """WebP is a valid upload type: accepted, stored under a uuid4().hex name."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    headers = auth_headers("admin")

    response = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={"photo": ("photo.webp", WEBP_BYTES, "image/webp")},
    )

    assert response.status_code == 201
    stored_name = response.json()["photo_url"].removeprefix("/uploads/")
    assert re.fullmatch(r"[0-9a-f]{32}\.webp", stored_name)
    stored_file = upload_dir / stored_name
    assert stored_file.is_file()
    assert stored_file.read_bytes() == WEBP_BYTES


def test_uploads_root_and_missing_files_are_never_listed_or_served(client) -> None:
    """S11 No directory listing: /uploads root and unknown files → 404, never HTML."""
    root = client.get("/uploads/")
    assert root.status_code == 404
    assert "text/html" not in root.headers.get("content-type", "")
    assert "index.html" not in root.text

    missing = client.get("/uploads/does-not-exist.png")
    assert missing.status_code == 404
    assert "text/html" not in missing.headers.get("content-type", "")
    assert "index.html" not in missing.text


def test_uploads_never_shadows_api_and_serves_only_stored_files(
    client, auth_headers
) -> None:
    """S12 API never shadowed: /api stays reachable; /uploads never serves the SPA."""
    headers = auth_headers("admin")
    api = client.get("/api/v1/pantone-colors", headers=headers)
    assert api.status_code == 200, "REST tree must stay reachable with /uploads mounted"

    spa_capture = client.get("/uploads/not-a-real-file.png")
    assert spa_capture.status_code == 404, "the SPA catch-all must not capture /uploads"
    assert "text/html" not in spa_capture.headers.get("content-type", "")
    assert "index.html" not in spa_capture.text


def test_uploaded_photo_is_served_back_from_uploads(
    client, auth_headers, monkeypatch, tmp_path
) -> None:
    """Stored uploads are served at /uploads/{name} (single origin, exact bytes)."""
    upload_dir = tmp_path / "uploads"
    monkeypatch.setattr(settings, "upload_dir", str(upload_dir))
    headers = auth_headers("admin")

    created = client.post(
        "/api/v1/samples/upload",
        headers=headers,
        files={"photo": ("photo.png", PNG_BYTES, "image/png")},
    )
    assert created.status_code == 201
    photo_url = created.json()["photo_url"]

    served = client.get(photo_url)
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/png")
    assert served.content == PNG_BYTES


# --- Slice C: backend CRUD + audited lifecycle ------------------------------
#
# Samples spec "Sample CRUD with Optional Photo" (S2 create without photo,
# S3 photo added later) and "Free Audited Status Lifecycle" (S4 audited
# transition, S5 any direction), "Reusable Listing by Target Pantone" (S6
# window capped, S7 fewer than five) and the CRUD no-delete rule (S1
# "A sample MUST never be hard-deleted"). Each status transition writes
# exactly one ``sample.status`` audit row in the same transaction, and
# every create writes a ``sample.create`` row (design ADR-6).


def _create_color(client, headers, code="221C") -> int:
    response = client.post(
        "/api/v1/pantone-colors",
        headers=headers,
        json={"code": code, "paint_type": "reactiva"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_sample(client, headers, color_id, **overrides):
    payload = {"pantone_target_id": color_id}
    payload.update(overrides)
    return client.post("/api/v1/samples", headers=headers, json=payload)


def test_create_sample_without_photo_has_null_photo_url(
    client, auth_headers, session_factory
) -> None:
    """S2 Create without photo: persists with null photo_url, default status."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    created = _create_sample(client, headers, color_id)
    assert created.status_code == 201
    body = created.json()
    assert body["photo_url"] is None
    assert body["status"] == "archivada_reutilizable"  # register = near-miss
    assert body["pantone_target_id"] == color_id
    sample_id = body["id"]

    with session_factory() as db:
        sample = db.get(Sample, sample_id)
        assert sample is not None
        assert sample.photo_url is None
        assert sample.pantone_target_id == color_id
        assert sample.status.value == "archivada_reutilizable"
        assert sample.created_by == 1  # seeded admin occupies id 1


def test_create_sample_with_photo_url_persists_it(
    client, auth_headers, session_factory
) -> None:
    """S2 triangulation: an explicit photo_url at create time is persisted."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    created = _create_sample(
        client, headers, color_id, photo_url="/uploads/initial.png"
    )
    assert created.status_code == 201
    assert created.json()["photo_url"] == "/uploads/initial.png"

    with session_factory() as db:
        stored = db.get(Sample, created.json()["id"])
        assert stored.photo_url == "/uploads/initial.png"


def test_create_sample_with_nonexistent_pantone_target_is_404(
    client, auth_headers
) -> None:
    """A sample must anchor to a real Pantone target: unknown id → 404."""
    headers = auth_headers("admin")
    response = _create_sample(client, headers, 99999)
    assert response.status_code == 404
    assert response.json()["detail"] == "Color Pantone no encontrado"


def test_patch_adds_photo_url_later_persisted_and_audited(
    client, auth_headers, session_factory
) -> None:
    """S3 Photo added later: PATCH photo_url → persisted + audited."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]
    with session_factory() as db:
        admin_id = db.scalar(sa.select(User.id).where(User.username == "admin"))

    patched = client.patch(
        f"/api/v1/samples/{sample_id}",
        headers=headers,
        json={"photo_url": "/uploads/later.png"},
    )
    assert patched.status_code == 200
    assert patched.json()["photo_url"] == "/uploads/later.png"

    with session_factory() as db:
        assert db.get(Sample, sample_id).photo_url == "/uploads/later.png"
        actions = db.execute(
            sa.select(AccessLog.action, AccessLog.user_id)
        ).all()
        assert ("sample.create", admin_id) in actions
        assert ("sample.update", admin_id) in actions


def test_transition_to_descatada_logs_exactly_one_row_same_txn(
    client, auth_headers, session_factory
) -> None:
    """S4 Audited transition: archivada → descartada writes ONE sample.status
    row in the same transaction as the status change."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    patched = client.patch(
        f"/api/v1/samples/{sample_id}",
        headers=headers,
        json={"status": "descartada"},
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "descartada"

    with session_factory() as db:
        assert db.get(Sample, sample_id).status.value == "descartada"
        status_rows = db.execute(
            sa.select(AccessLog).where(AccessLog.action == "sample.status")
        ).all()
        assert len(status_rows) == 1, "exactly one sample.status row per transition"
        sample_rows = db.execute(
            sa.select(AccessLog).where(AccessLog.action.like("sample.%"))
        ).all()
        # create + one transition → exactly two sample audit rows, same txns
        assert len(sample_rows) == 2


def test_all_six_status_transitions_succeed_and_are_audited(
    client, auth_headers, session_factory
) -> None:
    """S5 Any direction: every one of the 6 directed transitions succeeds and
    each is audited with its own sample.status row."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    transitions = [
        "aprobada",
        "descartada",
        "archivada_reutilizable",
        "descartada",
        "aprobada",
        "archivada_reutilizable",
    ]
    for target in transitions:
        response = client.patch(
            f"/api/v1/samples/{sample_id}",
            headers=headers,
            json={"status": target},
        )
        assert response.status_code == 200, f"transition to {target} failed"
        assert response.json()["status"] == target

    with session_factory() as db:
        status_rows = db.execute(
            sa.select(AccessLog.id).where(AccessLog.action == "sample.status")
        ).all()
        assert len(status_rows) == len(transitions)
        sample_rows = db.execute(
            sa.select(AccessLog).where(AccessLog.action.like("sample.%"))
        ).all()
        assert len(sample_rows) == len(transitions) + 1  # + the create row


def test_patch_cannot_change_pantone_target_id(
    client, auth_headers, session_factory
) -> None:
    """PATCH scope (design ADR-6): pantone_target_id is immutable post-create;
    an attempt is rejected (400) and never silently ignored."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    other_color_id = _create_color(client, headers, code="294C")
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    patched = client.patch(
        f"/api/v1/samples/{sample_id}",
        headers=headers,
        json={"status": "aprobada", "pantone_target_id": other_color_id},
    )
    assert patched.status_code == 400

    with session_factory() as db:
        stored = db.get(Sample, sample_id)
        assert stored.pantone_target_id == color_id, "target must stay immutable"
        assert stored.status.value == "archivada_reutilizable", (
            "rejected PATCH must not mutate any field"
        )


def test_reusable_listing_capped_at_five_newest_first(
    client, auth_headers
) -> None:
    """S6 Window capped: >5 reusable samples → at most 5, newest-first."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    other_color_id = _create_color(client, headers, code="294C")

    created_ids = [
        _create_sample(client, headers, color_id).json()["id"]
        for _ in range(7)
    ]
    # demote the OLDEST sample to descartada: it must NOT leak into the
    # reusable listing (status filter)
    assert client.patch(
        f"/api/v1/samples/{created_ids[0]}", headers=headers,
        json={"status": "descartada"},
    ).status_code == 200
    # a sample for a different target must NOT leak (target filter)
    _create_sample(client, headers, other_color_id)

    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={"pantone_target_id": color_id, "status": "archivada_reutilizable"},
    )
    assert listing.status_code == 200
    returned = listing.json()
    assert len(returned) <= 5
    assert [s["id"] for s in returned] == created_ids[-5:][::-1], (
        "expected the 5 newest reusable samples, newest-first"
    )
    assert all(s["pantone_target_id"] == color_id for s in returned)
    assert all(s["status"] == "archivada_reutilizable" for s in returned)


def test_reusable_listing_fewer_than_five_returns_all(
    client, auth_headers
) -> None:
    """S7 Fewer than five: all reusable samples for the target return."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)

    created_ids = [
        _create_sample(client, headers, color_id).json()["id"]
        for _ in range(3)
    ]

    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={"pantone_target_id": color_id, "status": "archivada_reutilizable"},
    )
    assert listing.status_code == 200
    assert [s["id"] for s in listing.json()] == created_ids[::-1]


# --- Batch listing (N+1 fix): GET /samples?pantone_target_ids=1,2,3 ---------
#
# The batch endpoint fetches reusable samples for MULTIPLE target Pantones in
# one request (comma-separated ``pantone_target_ids``), keeping the cap-5-per-
# color + status semantics of the single-target reusable listing (design
# ADR-6, spec S6/S7). When given, the batch filter takes precedence over a
# single ``pantone_target_id``.


def test_batch_listing_returns_samples_for_all_targets(
    client, auth_headers
) -> None:
    """Batch: reusable samples for multiple targets in one request, each
    correctly grouped under its own pantone_target_id."""
    headers = auth_headers("admin")
    color_a = _create_color(client, headers)
    color_b = _create_color(client, headers, code="294C")

    a_ids = [_create_sample(client, headers, color_a).json()["id"] for _ in range(2)]
    b_ids = [_create_sample(client, headers, color_b).json()["id"] for _ in range(2)]

    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={
            "pantone_target_ids": f"{color_a},{color_b}",
            "status": "archivada_reutilizable",
        },
    )
    assert listing.status_code == 200
    returned = listing.json()
    by_target: dict[int, list[int]] = {}
    for s in returned:
        by_target.setdefault(s["pantone_target_id"], []).append(s["id"])
    assert by_target[color_a] == a_ids[::-1], "color A samples, newest-first"
    assert by_target[color_b] == b_ids[::-1], "color B samples, newest-first"
    assert set(by_target) == {color_a, color_b}


def test_batch_listing_caps_five_per_target_color(
    client, auth_headers
) -> None:
    """Batch keeps the cap-5-per-color window: >5 reusable samples for EACH of
    several targets return at most 5 each — a plain global LIMIT would collapse
    them into 5 total across all colors."""
    headers = auth_headers("admin")
    color_a = _create_color(client, headers)
    color_b = _create_color(client, headers, code="294C")

    a_ids = [_create_sample(client, headers, color_a).json()["id"] for _ in range(7)]
    b_ids = [_create_sample(client, headers, color_b).json()["id"] for _ in range(7)]

    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={
            "pantone_target_ids": f"{color_a},{color_b}",
            "status": "archivada_reutilizable",
        },
    )
    assert listing.status_code == 200
    returned = listing.json()
    assert len(returned) <= 10, "at most 5 per color across two colors"

    by_target: dict[int, list[int]] = {}
    for s in returned:
        by_target.setdefault(s["pantone_target_id"], []).append(s["id"])
    assert by_target[color_a] == a_ids[-5:][::-1], (
        "color A: 5 newest reusable samples, newest-first"
    )
    assert by_target[color_b] == b_ids[-5:][::-1], (
        "color B: 5 newest reusable samples, newest-first"
    )


def test_batch_listing_takes_precedence_over_single_target(
    client, auth_headers
) -> None:
    """Batch precedence: when both ``pantone_target_ids`` and
    ``pantone_target_id`` are given, the batch filter wins and the single
    target is ignored."""
    headers = auth_headers("admin")
    color_a = _create_color(client, headers)
    color_b = _create_color(client, headers, code="294C")

    a_id = _create_sample(client, headers, color_a).json()["id"]
    b_id = _create_sample(client, headers, color_b).json()["id"]

    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={
            "pantone_target_id": color_a,          # single target (must be ignored)
            "pantone_target_ids": f"{color_b}",    # batch wins
            "status": "archivada_reutilizable",
        },
    )
    assert listing.status_code == 200
    returned = listing.json()
    assert [s["id"] for s in returned] == [b_id], (
        "batch filter must take precedence over the single target"
    )


def test_batch_listing_without_status_returns_all(
    client, auth_headers
) -> None:
    """Batch without a status filter applies no cap and no status filter: all
    matching samples for the listed targets return (mirrors the single-target
    unbounded behavior)."""
    headers = auth_headers("admin")
    color_a = _create_color(client, headers)
    color_b = _create_color(client, headers, code="294C")

    created = [
        _create_sample(client, headers, color_a).json()["id"] for _ in range(6)
    ]
    _create_sample(client, headers, color_b)

    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={"pantone_target_ids": f"{color_a},{color_b}"},
    )
    assert listing.status_code == 200
    returned = listing.json()
    assert all(s["pantone_target_id"] in {color_a, color_b} for s in returned)
    assert len(returned) == 7, "no cap/status filter in batch mode without status"


def test_batch_listing_rejects_non_numeric_ids(
    client, auth_headers
) -> None:
    """Batch: a non-numeric value in the comma-separated list is rejected with
    422 — never a silent filter or a 500."""
    headers = auth_headers("admin")
    listing = client.get(
        "/api/v1/samples",
        headers=headers,
        params={"pantone_target_ids": "1,abc,3", "status": "archivada_reutilizable"},
    )
    assert listing.status_code == 422


def test_delete_sample_returns_405(client, auth_headers) -> None:
    """A sample must never be hard-deleted: DELETE is not routed → 405."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    deleted = client.delete(f"/api/v1/samples/{sample_id}", headers=headers)
    assert deleted.status_code == 405


# --- Slice F: atomic promote -----------------------------------------------
#
# Samples spec "Atomic Promote" (S13 happy-path, S14 rollback on failure) and
# the 409/404 guards from design ADR-4. Promoting a sample creates a NEW
# formula in one transaction, derives ``pantone_color_id`` from the sample's
# ``pantone_target_id`` (never client-supplied), marks the sample ``aprobada``,
# sets ``formula_id``, and writes exactly ONE ``sample.promote`` audit row.
# Request body mirrors FormulaCreate minus ``pantone_color_id`` (derived).


def _promote_payload(**overrides):
    payload = {
        "name": "Fórmula promovida",
        "notes": "derivada de muestra",
        "ingredients": [
            {"colorant": "Amarillo", "quantity": "10", "unit": "g"},
            {"colorant": "Negro", "quantity": "0.5", "unit": "g"},
        ],
    }
    payload.update(overrides)
    return payload


def test_promote_happy_path_creates_formula_and_links_sample(
    client, auth_headers, session_factory
) -> None:
    """S13 Happy-path promote: a formula is created, the sample becomes
    ``aprobada`` with ``formula_id`` set, and exactly ONE ``sample.promote``
    audit row is written in the same transaction."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    response = client.post(
        f"/api/v1/samples/{sample_id}/promote",
        headers=headers,
        json=_promote_payload(),
    )
    assert response.status_code == 201
    body = response.json()

    formula = body["formula"]
    assert formula["pantone_color_id"] == color_id, (
        "pantone_color_id derived from the sample's pantone_target_id"
    )
    assert formula["name"] == "Fórmula promovida"
    assert {i["colorant"] for i in formula["ingredients"]} == {"Amarillo", "Negro"}
    formula_id = formula["id"]

    sample = body["sample"]
    assert sample["id"] == sample_id
    assert sample["status"] == "aprobada", "promote marks the sample aprobada"
    assert sample["formula_id"] == formula_id, "sample links back to the new formula"

    with session_factory() as db:
        stored = db.get(Sample, sample_id)
        assert stored.status.value == "aprobada"
        assert stored.formula_id == formula_id
        promote_rows = db.execute(
            sa.select(AccessLog).where(AccessLog.action == "sample.promote")
        ).all()
        assert len(promote_rows) == 1, "exactly ONE sample.promote audit row"
        # create + promote => exactly two sample audit rows, same transactions
        sample_rows = db.execute(
            sa.select(AccessLog.id).where(AccessLog.action.like("sample.%"))
        ).all()
        assert len(sample_rows) == 2


def test_promote_failure_rolls_back_within_transaction(
    client, auth_headers, session_factory, monkeypatch
) -> None:
    """S14 Rollback on failure: a promote that fails MID-transaction persists
    nothing. We monkeypatch the promote audit write to raise after the formula
    insert + sample mutation, forcing the ``except: db.rollback()`` path — the
    sample must stay ``archivada_reutilizable`` with no formula and no audit
    row. (TestClient re-raises the server exception by default, so we assert
    the exception propagated AND the transaction rolled back.)"""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    # Fail the audit write inside the promote transaction, after the formula
    # INSERT and the sample mutation have already been staged.
    def _boom(_db, _user_id, _action):
        raise RuntimeError("simulated promote audit failure")

    monkeypatch.setattr("app.modules.samples.router.log_action", _boom)

    with pytest.raises(RuntimeError, match="simulated promote audit failure"):
        client.post(
            f"/api/v1/samples/{sample_id}/promote",
            headers=headers,
            json=_promote_payload(),
        )

    with session_factory() as db:
        stored = db.get(Sample, sample_id)
        assert stored.status.value == "archivada_reutilizable", "sample unchanged"
        assert stored.formula_id is None, "no formula linked to the sample"
        promote_rows = db.execute(
            sa.select(AccessLog).where(AccessLog.action == "sample.promote")
        ).all()
        assert len(promote_rows) == 0, "no promote audit row on rolled-back failure"
        # No formula may survive the rollback either.
        formulas = db.execute(sa.select(sa.func.count()).select_from(
            sa.text("formulas")
        )).scalar_one()
        assert formulas == 0, "rolled-back formula must not persist"


def test_promote_empty_ingredients_rejected_and_sample_unchanged(
    client, auth_headers, session_factory
) -> None:
    """A promote with no ingredients is rejected (422) before any write, so the
    sample stays ``archivada_reutilizable`` with no formula and no audit row."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]

    response = client.post(
        f"/api/v1/samples/{sample_id}/promote",
        headers=headers,
        json=_promote_payload(ingredients=[]),
    )
    assert response.status_code == 422

    with session_factory() as db:
        stored = db.get(Sample, sample_id)
        assert stored.status.value == "archivada_reutilizable", "sample unchanged"
        assert stored.formula_id is None, "no formula linked to the sample"
        promote_rows = db.execute(
            sa.select(AccessLog).where(AccessLog.action == "sample.promote")
        ).all()
        assert len(promote_rows) == 0, "no promote audit row on rejected promote"


def test_promote_non_reusable_sample_returns_409(client, auth_headers) -> None:
    """Promote is only allowed on an ``archivada_reutilizable`` sample: any
    other status returns 409 (design ADR-4)."""
    headers = auth_headers("admin")
    color_id = _create_color(client, headers)
    sample_id = _create_sample(client, headers, color_id).json()["id"]
    # Demote it to descartada so it is no longer reusable.
    assert client.patch(
        f"/api/v1/samples/{sample_id}", headers=headers,
        json={"status": "descartada"},
    ).status_code == 200

    response = client.post(
        f"/api/v1/samples/{sample_id}/promote",
        headers=headers,
        json=_promote_payload(),
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "La muestra debe estar archivada como reutilizable"


def test_promote_missing_sample_returns_404(client, auth_headers) -> None:
    """Promoting a sample that does not exist returns 404."""
    headers = auth_headers("admin")
    response = client.post(
        "/api/v1/samples/99999/promote",
        headers=headers,
        json=_promote_payload(),
    )
    assert response.status_code == 404

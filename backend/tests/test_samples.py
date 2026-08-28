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
"""

import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

from app.core.config import settings

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

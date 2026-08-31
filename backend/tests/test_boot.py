"""Boot acceptance: the app factory exists and serves the API docs + SPA.

Covers the base spec "Application Entry Point": the FastAPI app boots via
``python -m uvicorn app.main:app`` from the backend venv (the PATH
``uvicorn`` binary is a broken Termux stub and is never used) and the
Swagger UI loads at /docs.

It also guards the single-origin SPA fallback (bugfix regression): a GET to
any non-API path — e.g. ``/search`` or ``/formulas`` — must return the built
SPA's ``index.html`` with status 200, so client-side routes survive browser
refresh and deep links, instead of a FastAPI 404 JSON.
"""

from fastapi.testclient import TestClient

from app.main import FRONTEND_DIST, create_app


def test_create_app_exposes_api_title() -> None:
    app = create_app()
    assert app.title == "Telary Color API"


def test_docs_swagger_ui_served() -> None:
    client = TestClient(create_app())
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger-ui" in response.text


def test_openapi_schema_served() -> None:
    client = TestClient(create_app())
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Telary Color API"


def test_spa_serves_index_at_root() -> None:
    if not FRONTEND_DIST.is_dir():
        return  # no build → SPA mount skipped (API-only / test-only env)
    client = TestClient(create_app())
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "<!doctype html>" in response.text


def test_spa_fallback_serves_index_for_client_routed_paths() -> None:
    """Regression: a deep link / refresh to a non-API route must serve the
    SPA index.html (200), never a FastAPI 404 JSON. Mirrors a phone reload on
    ``/search`` or ``/formulas``."""
    if not FRONTEND_DIST.is_dir():
        return  # no build → SPA mount skipped
    client = TestClient(create_app())
    for path in ("/search", "/formulas", "/pantone", "/inventario/alertas"):
        response = client.get(path)
        assert response.status_code == 200, f"{path} returned {response.status_code}"
        assert response.headers["content-type"].startswith("text/html")
        assert "<!doctype html>" in response.text


def test_spa_fallback_never_shadows_api_or_uploads() -> None:
    """The SPA catch-all must never capture the REST tree or uploads."""
    if not FRONTEND_DIST.is_dir():
        return
    client = TestClient(create_app())
    # An unknown API path still returns the API 404 JSON, not the SPA HTML.
    response = client.get("/api/v1/definitely-not-a-route")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json().get("detail") == "Not Found"


def test_spa_is_not_path_traversal_exploitable() -> None:
    """A traversal attempt must never serve files from outside the build dir.

    The static resolver uses ``StaticFiles.lookup_path`` (normpath-guarded),
    so ``../`` / absolute-path / URL-encoded probes resolve to a non-existent
    path inside the tree and fall through to the SPA ``index.html`` — never to
    an arbitrary host file. Only the SPA HTML is served for such requests.
    """
    if not FRONTEND_DIST.is_dir():
        return
    index_html = (FRONTEND_DIST / "index.html").resolve().read_text()
    client = TestClient(create_app())
    probes = (
        "/../secrets.txt",
        "/../../etc/passwd",
        "/../..",
        "/assets/../../index.html",
        "/%2e%2e/%2e%2e/etc/passwd",
    )
    for path in probes:
        response = client.get(path)
        # Served content is always exactly the SPA index.html (never a host file).
        assert response.status_code == 200, f"{path} -> {response.status_code}"
        assert response.headers["content-type"].startswith("text/html")
        assert response.text == index_html, f"{path} leaked non-index content"


def test_spa_does_not_intercept_api_routes() -> None:
    """No path under /api/ is swallowed by the client-routing fallback.

    The fallback must hand every /api/ route back to the REST router so the
    router's own answer (a 404 JSON, a 401 auth error, a 200, ...) is returned
    verbatim — never SPA HTML. The authenticated 404-JSON-for-missing-resource
    case is asserted in test_pantone_colors.py::test_read_missing_returns_404
    against the same app; here we prove the unauthenticated probe (401, since
    the collection router authenticates before existence checks) is not turned
    into SPA HTML by the fallback.
    """
    if not FRONTEND_DIST.is_dir():
        return
    index_html = (FRONTEND_DIST / "index.html").resolve().read_text()
    client = TestClient(create_app())
    response = client.get("/api/v1/pantone-colors/99999")
    # Never the SPA HTML — the REST router answered (401 without a token here).
    assert response.headers["content-type"].startswith("application/json")
    assert response.text != index_html
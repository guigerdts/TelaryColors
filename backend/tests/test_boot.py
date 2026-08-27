"""Boot acceptance: the app factory exists and serves the API docs.

Covers the base spec "Application Entry Point": the FastAPI app boots via
``python -m uvicorn app.main:app`` from the backend venv (the PATH
``uvicorn`` binary is a broken Termux stub and is never used) and the
Swagger UI loads at /docs.
"""

from fastapi.testclient import TestClient

from app.main import create_app


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
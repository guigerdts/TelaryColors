"""Application-wide settings loaded from environment / backend/.env.

See backend/.env.example for the documented variables.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Telary Color backend.

    Values are read from environment variables first, then from a
    ``backend/.env`` file when present (see ``.env.example``).
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Telary Color API"
    database_url: str = "sqlite:///./data/app.db"

    # JWT signing (auth spec: HS256, 12h expiry). SECRET_KEY must be
    # overridden in production via the environment / backend/.env.
    secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_hours: int = 12

    # Seed admin bootstrap (design ADR-10): env-configured first, secure
    # default fallback. Override both in production via SEED_ADMIN_USERNAME /
    # SEED_ADMIN_PASSWORD.
    seed_admin_username: str = "admin"
    seed_admin_password: str = "telary-admin"


settings = Settings()
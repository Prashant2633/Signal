"""Application configuration.

Values are intentionally simple and read from the environment so the app can be
deployed to Render/Railway/etc. without code changes. Sensible defaults keep it
runnable out-of-the-box for local development.
"""
import os

# JWT signing secret. Override in production via the SECRET_KEY env var.
SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-change-me-in-prod")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_DAYS: int = 30

# The only OTP that is ever accepted. Real SMS verification is mocked per the spec.
MOCK_OTP: str = os.environ.get("MOCK_OTP", "123456")

# SQLite database location.
DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite:///./signal.db")

# Comma separated list of allowed CORS origins for the frontend.
CORS_ORIGINS: list[str] = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

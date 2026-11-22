"""Application configuration loaded from environment variables (.env supported)."""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR") or (DATA_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{(DATA_DIR / 'disasterlink.db').as_posix()}"


def _load_secret() -> str:
    env = os.getenv("SECRET_KEY")
    if env:
        return env
    f = DATA_DIR / ".secret_key"
    if f.exists():
        return f.read_text().strip()
    key = secrets.token_urlsafe(48)
    f.write_text(key)
    return key


SECRET_KEY = _load_secret()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or 480)

CORS_ORIGINS = [
    o.strip()
    for o in (os.getenv("CORS_ORIGINS") or
              "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",")
    if o.strip()
]

SEED_ON_STARTUP = (os.getenv("SEED_ON_STARTUP") or "true").lower() == "true"
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB") or 25)

AI_PROVIDER = (os.getenv("AI_PROVIDER") or "none").lower()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or ""
AI_MODEL = os.getenv("AI_MODEL") or "claude-opus-5-5"

APP_VERSION = "1.0.0"

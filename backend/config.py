import os


def _load_env_file():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(os.path.dirname(here), ".env")
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key, value = key.strip(), value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                os.environ.setdefault(key, value)
    except FileNotFoundError:
        pass


_load_env_file()

DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "perpustakaan")

PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("APP_HOST", "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
PRODUCTION = os.environ.get("APP_ENV") == "production"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = (
    os.path.join(PROJECT_DIR, "Frontend")
    if os.path.isdir(os.path.join(PROJECT_DIR, "Frontend"))
    else os.path.join(PROJECT_DIR, "frontend")
)
SCHEMA_PATH = os.path.join(BASE_DIR, "database", "perpustakaan.sql")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").replace(" ", "")
MAIL_FROM_NAME = "Keyto Perpustakaan"
APP_BASE_URL = os.environ.get("APP_BASE_URL", f"http://{HOST}:{PORT}").rstrip("/")
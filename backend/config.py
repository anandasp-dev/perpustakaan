import os

DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "perpustakaan")

HOST = "127.0.0.1"
PORT = 3000
PRODUCTION = os.environ.get("APP_ENV") == "production"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
SCHEMA_PATH = os.path.join(BASE_DIR, "database", "perpustakaan.sql")
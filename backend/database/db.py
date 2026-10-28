from contextlib import contextmanager
 
import mysql.connector
 
from config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, SCHEMA_PATH
 
 
def get_connection(use_database: bool = True):
    """Buat koneksi baru ke MySQL."""
    params = dict(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        charset="utf8mb4",
        collation="utf8mb4_unicode_ci",
        autocommit=False,
        connection_timeout=10,      # jangan menggantung selamanya kalau MySQL tidak menjawab
    )
    if use_database:
        params["database"] = DB_NAME
    return mysql.connector.connect(**params)
 
 
@contextmanager
def cursor():
    """
    Pakai di model:
 
        with cursor() as cur:
            cur.execute("SELECT * FROM `user` WHERE email = %s", (email,))
            row = cur.fetchone()          # dict, misalnya row["username"]
 
    Otomatis commit kalau sukses, rollback kalau error, dan koneksi selalu ditutup.
    Placeholder query memakai %s (bukan ?), dan nilainya selalu lewat parameter
    supaya aman dari SQL injection.
    """
    conn = get_connection()
    cur = None
    try:
        # buffered=True: hasil query langsung dibaca semua, sehingga tidak muncul
        # error "Unread result found" bila fetchone() tidak menghabiskan baris.
        cur = conn.cursor(dictionary=True, buffered=True)
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if cur is not None:
            cur.close()
        conn.close()
 
 
def _split_statements(script: str) -> list:
    """Pecah isi schema.sql menjadi perintah-perintah terpisah."""
    lines = [ln for ln in script.splitlines() if not ln.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]
 
 
def init_db() -> None:
    """Buat database (kalau belum ada) lalu semua tabel dari schema.sql."""
    conn = get_connection(use_database=False)
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            conn.commit()
        finally:
            cur.close()
    finally:
        conn.close()
 
    script = SCHEMA_PATH.read_text(encoding="utf-8")
    with cursor() as cur:
        for statement in _split_statements(script):
            cur.execute(statement)
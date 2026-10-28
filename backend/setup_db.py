"""Jalankan sekali untuk membuat database dan tabel:  python setup_db.py"""

import mysql.connector

from config import DB_HOST, DB_NAME, DB_PORT
from database.db import cursor, init_db


def main():
    try:
        init_db()
    except mysql.connector.Error as e:
        print(f"Gagal menyiapkan MySQL: {e}\n")
        print("Cek hal berikut:")
        print("  1. Server MySQL sudah menyala (Start di XAMPP/Laragon).")
        print(f"  2. Host dan port benar ({DB_HOST}:{DB_PORT}).")
        print("  3. User dan password benar (lihat DB_USER dan DB_PASSWORD di config.py).")
        raise SystemExit(1)

    print(f"Database siap: {DB_NAME} @ {DB_HOST}:{DB_PORT}\n")

    with cursor() as cur:
        cur.execute("SHOW TABLES")
        tables = [list(row.values())[0] for row in cur.fetchall()]
        for table in tables:
            cur.execute(f"SHOW COLUMNS FROM `{table}`")
            print(f"[{table}]  " + ", ".join(col["Field"] for col in cur.fetchall()))


if __name__ == "__main__":
    main()

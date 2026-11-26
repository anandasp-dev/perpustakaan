import base64
import binascii
import os

import config
from database.db import cursor

COVER_DIR = os.path.join(config.FRONTEND_DIR, "assets", "covers")
COVER_PREFIX = "assets/covers/"
MAX_COVER_BYTES = 800_000

# tipe gambar yang diizinkan: (ekstensi, tanda awal isi berkas)
_TYPES = {
    "image/jpeg": ("jpg", b"\xff\xd8\xff"),
    "image/png": ("png", b"\x89PNG\r\n\x1a\n"),
    "image/webp": ("webp", b"RIFF"),
}

_column_checked = False


class CoverError(Exception):
    """Gambar sampul tidak valid."""


def _ensure_cover_column():
    """Pastikan kolom cover di tabel buku cukup besar (MEDIUMTEXT) untuk menampung gambar Base64."""
    global _column_checked
    if _column_checked:
        return
    try:
        with cursor() as cur:
            cur.execute(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'buku' AND COLUMN_NAME = 'cover'"
            )
            row = cur.fetchone()
            if row and str(row.get("DATA_TYPE", "")).lower() not in ("mediumtext", "longtext"):
                cur.execute("ALTER TABLE buku MODIFY COLUMN cover MEDIUMTEXT NULL")
        _column_checked = True
    except Exception:
        pass


def save_cover(book_id, data_url):
    """Validasi gambar dan kembalikan Data URL Base64 untuk disimpan di database (aman untuk Vercel)."""
    if not isinstance(data_url, str) or not data_url.startswith("data:") or ";base64," not in data_url:
        raise CoverError("Format gambar tidak valid")

    header, encoded = data_url.split(";base64,", 1)
    mime = header[5:].strip().lower()
    if mime not in _TYPES:
        raise CoverError("Gambar harus berformat JPG, PNG, atau WEBP")

    clean_b64 = "".join(encoded.split())
    try:
        raw = base64.b64decode(clean_b64, validate=True)
    except (binascii.Error, ValueError):
        raise CoverError("Data gambar rusak")
    if len(raw) > MAX_COVER_BYTES:
        raise CoverError("Ukuran gambar terlalu besar (maksimal 800 KB)")

    _, magic = _TYPES[mime]
    if not raw.startswith(magic) or (mime == "image/webp" and raw[8:12] != b"WEBP"):
        raise CoverError("Isi berkas bukan gambar yang valid")

    _ensure_cover_column()
    return f"data:{mime};base64,{clean_b64}"


def delete_cover_file(path):
    """Hapus berkas sampul lama jika masih memakai file lokal; abaikan jika Data URL atau Read-Only."""
    if not path or path.startswith("data:") or not path.startswith(COVER_PREFIX):
        return
    target = os.path.join(COVER_DIR, os.path.basename(path))
    try:
        os.remove(target)
    except OSError:
        pass
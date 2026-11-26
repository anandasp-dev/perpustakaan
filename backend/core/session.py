import base64
import hashlib
import hmac
import json
import os
import time

COOKIE_NAME = "session_id"
SESSION_TTL = 2 * 60 * 60  # 2 jam (detik)

# Menggunakan SECRET_KEY jika ada, atau fallback ke DB_PASSWORD agar tetap konsisten di semua server Vercel
_RAW_SECRET = (
    os.environ.get("SECRET_KEY")
    or os.environ.get("DB_PASSWORD")
    or "perpustakaan-local-secret-key"
)
_SECRET = _RAW_SECRET.encode("utf-8")


def _sign(payload_b64: str) -> str:
    return hmac.new(_SECRET, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()


def create(user_id, ttl=SESSION_TTL):
    """Buat token sesi bertanda tangan (stateless) untuk dikirim lewat cookie."""
    payload = {
        "uid": user_id,
        "exp": int(time.time() + ttl),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw).decode("utf-8")
    return f"{payload_b64}.{_sign(payload_b64)}"


def get_user_id(token):
    """Kembalikan user_id kalau tanda tangan token valid dan belum kedaluwarsa, selain itu None."""
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(_sign(payload_b64), sig):
            return None
        raw = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
        if data.get("exp", 0) <= time.time():
            return None
        return data.get("uid")
    except Exception:
        return None


def destroy(token):
    """Logout ditangani dengan menghapus cookie di browser."""
    pass


def destroy_user(user_id):
    """Disediakan agar kompatibel dengan pemanggilan setelah reset password."""
    pass
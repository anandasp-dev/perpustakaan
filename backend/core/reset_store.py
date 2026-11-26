import base64
import hashlib
import hmac
import json
import os
import time

from models.user import User

RESET_TTL = 30 * 60  # 30 menit (detik)

_RAW_SECRET = (
    os.environ.get("SECRET_KEY")
    or os.environ.get("DB_PASSWORD")
    or "perpustakaan-local-secret-key"
)
_SECRET = (_RAW_SECRET + ":reset").encode("utf-8")


def _sign(payload_b64: str) -> str:
    return hmac.new(_SECRET, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()


def _pw_tag(user) -> str:
    pw_hash = (user or {}).get("password_hash") or ""
    return hashlib.sha256(pw_hash.encode("utf-8")).hexdigest()[:16]


def create(user_id, ttl=RESET_TTL):
    """Buat token reset password bertanda tangan (stateless)."""
    user = User.find_by_id(user_id)
    if not user:
        return None
    payload = {
        "uid": user_id,
        "exp": int(time.time() + ttl),
        "pwh": _pw_tag(user),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw).decode("utf-8")
    return f"{payload_b64}.{_sign(payload_b64)}"


def peek(token):
    """Periksa validitas token tanpa menghanguskannya; kembalikan user_id atau None."""
    if not token or not isinstance(token, str) or "." not in token:
        return None
    try:
        payload_b64, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(_sign(payload_b64), sig):
            return None
        raw = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
        if data.get("exp", 0) <= time.time():
            return None
        user = User.find_by_id(data.get("uid"))
        if not user or _pw_tag(user) != data.get("pwh"):
            return None
        return user["id"]
    except Exception:
        return None


def consume(token):
    """Validasi token saat submit reset password (otomatis hangus setelah password berubah)."""
    return peek(token)
import secrets
import threading
import time

COOKIE_NAME = "session_id"
SESSION_TTL = 2 * 60 * 60  # 2 jam (detik)

_sessions = {}  # token -> {"user_id": ..., "expires_at": ...}
_lock = threading.Lock()


def _purge_expired(now):
    """Buang semua sesi yang sudah kedaluwarsa (dipanggil di dalam lock)."""
    expired = [t for t, s in _sessions.items() if s["expires_at"] <= now]
    for t in expired:
        del _sessions[t]


def create(user_id, ttl=SESSION_TTL):
    """Buat sesi baru, kembalikan token untuk dikirim lewat cookie."""
    token = secrets.token_urlsafe(32)
    now = time.time()
    with _lock:
        _purge_expired(now)
        _sessions[token] = {"user_id": user_id, "expires_at": now + ttl}
    return token


def get_user_id(token):
    """Kembalikan user_id kalau token valid dan belum kedaluwarsa, selain itu None."""
    if not token:
        return None
    now = time.time()
    with _lock:
        data = _sessions.get(token)
        if data is None:
            return None
        if data["expires_at"] <= now:
            del _sessions[token]
            return None
        return data["user_id"]


def destroy(token):
    """Hapus sesi (logout). Aman dipanggil walau token tidak ada."""
    with _lock:
        _sessions.pop(token, None)
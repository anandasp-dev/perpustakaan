import json
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, parse_qs

MAX_BODY = 1_000_000  # 1 MB


class BadRequestError(Exception):
    """Body permintaan tidak valid (nanti jadi respons 400)."""


class Request:
    def __init__(self, handler):
        self._handler = handler
        self.method = handler.command
        parts = urlsplit(handler.path)
        self.path = parts.path
        self.query = {k: v[0] for k, v in parse_qs(parts.query).items()}
        self.headers = handler.headers
        self.params = {}   # diisi router, contoh {"id": "5"}
        self.user = None   # diisi nanti kalau sudah login
        self._body = None

    @property
    def cookies(self):
        jar = SimpleCookie()
        jar.load(self.headers.get("Cookie", ""))
        return {name: morsel.value for name, morsel in jar.items()}

    def json(self):
        """Baca body sebagai JSON (harus berupa objek). Salah format -> BadRequestError."""
        if self._body is None:
            try:
                length = int(self.headers.get("Content-Length", 0))
            except ValueError:
                raise BadRequestError("Content-Length tidak valid")
            if length > MAX_BODY:
                raise BadRequestError("Data terlalu besar")
            raw = self._handler.rfile.read(length) if length > 0 else b""
            try:
                self._body = json.loads(raw.decode("utf-8")) if raw else {}
            except (ValueError, UnicodeDecodeError):
                raise BadRequestError("Body harus berupa JSON yang valid")
            if not isinstance(self._body, dict):
                raise BadRequestError("Body harus berupa objek JSON")
        return self._body
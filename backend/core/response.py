import json
from datetime import date, datetime


def _serialize(obj):
    """Ubah datetime/date jadi string supaya bisa masuk JSON."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat(sep=" ") if isinstance(obj, datetime) else obj.isoformat()
    raise TypeError(f"Tidak bisa diubah ke JSON: {type(obj)}")


class Response:
    def __init__(self, status=200, data=None):
        self.status = status
        self.data = data
        self.headers = {}
        self.cookies = []  # daftar string Set-Cookie

    def set_cookie(self, name, value, max_age=None, secure=False):
        cookie = f"{name}={value}; Path=/; HttpOnly; SameSite=Lax"
        if max_age is not None:
            cookie += f"; Max-Age={max_age}"
        if secure:
            cookie += "; Secure"
        self.cookies.append(cookie)

    def clear_cookie(self, name):
        self.cookies.append(f"{name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")

    def send(self, handler):
        body = b""
        if self.data is not None:
            body = json.dumps(self.data, default=_serialize, ensure_ascii=False).encode("utf-8")
        handler.send_response(self.status)
        if self.data is not None:
            handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        for key, value in self.headers.items():
            handler.send_header(key, value)
        for cookie in self.cookies:
            handler.send_header("Set-Cookie", cookie)
        handler.end_headers()
        if handler.command != "HEAD":
            handler.wfile.write(body)


def error(message, status=400):
    """Format error konsisten: {"message": "..."}"""
    return Response(status, {"message": message})
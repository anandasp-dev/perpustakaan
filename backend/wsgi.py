import json
import os
import sys
import traceback
from http import HTTPStatus

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import CONTENT_TYPES, LOGIN_PAGE, access_level, resolve_static
from core import session
from core.request import Request
from core.response import Response, _serialize, error
from models.user import User
from routes import router


class _CaseInsensitiveHeaders(dict):
    def get(self, key, default=None):
        return super().get(key.lower(), default)


class _WsgiHandlerAdapter:
    def __init__(self, environ):
        self.command = environ.get("REQUEST_METHOD", "GET").upper()
        raw_path = environ.get("PATH_INFO", "/")
        qs = environ.get("QUERY_STRING", "")
        self.path = f"{raw_path}?{qs}" if qs else raw_path
        self.rfile = environ.get("wsgi.input")

        headers = _CaseInsensitiveHeaders()
        for k, v in environ.items():
            if k.startswith("HTTP_"):
                header_name = k[5:].replace("_", "-").lower()
                headers[header_name] = v
        if environ.get("CONTENT_TYPE"):
            headers["content-type"] = environ["CONTENT_TYPE"]
        if environ.get("CONTENT_LENGTH"):
            headers["content-length"] = environ["CONTENT_LENGTH"]
        self.headers = headers


def _status_line(code):
    try:
        phrase = HTTPStatus(code).phrase
    except ValueError:
        phrase = "OK"
    return f"{code} {phrase}"


def _send_json_response(res: Response, method: str, start_response):
    body = b""
    if res.data is not None:
        body = json.dumps(res.data, default=_serialize, ensure_ascii=False).encode("utf-8")

    headers = []
    if res.data is not None:
        headers.append(("Content-Type", "application/json; charset=utf-8"))
    headers.append(("Content-Length", str(len(body))))
    for k, v in res.headers.items():
        headers.append((k, str(v)))
    for cookie in res.cookies:
        headers.append(("Set-Cookie", cookie))

    start_response(_status_line(res.status), headers)
    return [b"" if method == "HEAD" else body]


def _redirect(location: str, start_response):
    start_response("302 Found", [("Location", location), ("Content-Length", "0")])
    return [b""]


def _current_user(request: Request):
    user_id = session.get_user_id(request.cookies.get(session.COOKIE_NAME))
    return User.find_by_id(user_id) if user_id else None


def application(environ, start_response):
    try:
        adapter = _WsgiHandlerAdapter(environ)
        request = Request(adapter)

        if request.path.startswith("/api/"):
            res = router.dispatch(request)
            return _send_json_response(res, request.method, start_response)

        if request.method not in ("GET", "HEAD"):
            return _send_json_response(error("Method tidak diizinkan", 405), request.method, start_response)

        if request.path == "/":
            return _redirect(LOGIN_PAGE, start_response)

        full = resolve_static(request.path)
        if full is None:
            return _send_json_response(error("Tidak ditemukan", 404), request.method, start_response)

        if request.path.lower().endswith(".html"):
            qs = environ.get("QUERY_STRING", "")
            target = request.path[:-5] + (f"?{qs}" if qs else "")
            return _redirect(target, start_response)

        level = access_level(full)
        if level != "public":
            user = _current_user(request)
            if user is None:
                return _redirect(LOGIN_PAGE, start_response)
            if level == "admin" and user["role"] != "admin":
                return _send_json_response(error("Anda tidak punya akses", 403), request.method, start_response)

        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            data = f.read()

        headers = [
            ("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream")),
            ("Content-Length", str(len(data))),
            ("Cache-Control", "no-cache"),
            ("X-Content-Type-Options", "nosniff"),
        ]
        start_response("200 OK", headers)
        return [b"" if request.method == "HEAD" else data]

    except Exception:
        traceback.print_exc()
        return _send_json_response(error("Terjadi kesalahan pada server", 500), "GET", start_response)
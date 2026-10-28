import os
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

from config import HOST, PORT, FRONTEND_DIR
from core import session
from core.request import Request
from core.response import error
from models.user import User
from routes import router

ROOT = os.path.realpath(FRONTEND_DIR)
ALLOWED_DIRS = {os.path.normcase(n) for n in ("Pages", "Style", "Js")}
PROTECTED = [os.path.join(ROOT, "Pages", "dashboard.html")]  # wajib login
LOGIN_PAGE = "/Pages/login.html"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}


def resolve_static(url_path):
    """Ubah URL jadi path file di frontend/. Kembalikan None kalau tidak boleh/tidak ada."""
    try:
        rel = unquote(url_path).lstrip("/")
        full = os.path.realpath(os.path.join(ROOT, rel))
        common = os.path.commonpath([full, ROOT])
        if os.path.normcase(common) != os.path.normcase(ROOT):
            return None  # keluar dari folder frontend (path traversal)
    except ValueError:
        return None
    first = os.path.relpath(full, ROOT).split(os.sep)[0]
    if os.path.normcase(first) not in ALLOWED_DIRS or not os.path.isfile(full):
        return None
    return full


class Handler(BaseHTTPRequestHandler):
    server_version = "Perpustakaan"

    def do_GET(self):
        self._handle()

    do_POST = do_PUT = do_PATCH = do_DELETE = do_GET

    def _handle(self):
        try:
            request = Request(self)
            if request.path.startswith("/api/"):
                router.dispatch(request).send(self)
            elif request.method != "GET":
                error("Method tidak diizinkan", 405).send(self)
            elif request.path == "/":
                self._redirect(LOGIN_PAGE)
            else:
                self._serve_static(request)
        except Exception:
            traceback.print_exc()
            error("Terjadi kesalahan pada server", 500).send(self)

    def _logged_in(self, request):
        user_id = session.get_user_id(request.cookies.get(session.COOKIE_NAME))
        return user_id is not None and User.find_by_id(user_id) is not None

    def _serve_static(self, request):
        full = resolve_static(request.path)
        if full is None:
            error("Tidak ditemukan", 404).send(self)
            return

        is_protected = any(
            os.path.exists(p) and os.path.samefile(full, p) for p in PROTECTED
        )
        if is_protected and not self._logged_in(request):
            self._redirect(LOGIN_PAGE)
            return

        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Server berjalan di http://{HOST}:{PORT}  (tekan Ctrl+C untuk berhenti)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
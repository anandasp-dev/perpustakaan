import os
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from config import HOST, PORT, FRONTEND_DIR
from core import session
from core.request import Request
from core.response import error
from models.user import User
from routes import router

ROOT = os.path.realpath(FRONTEND_DIR)
ROOT_INDEX = os.path.realpath(os.path.join(ROOT, "index.html"))
ALLOWED_DIRS = {os.path.normcase(n) for n in ("Pages", "Style", "Js", "assets")}
LOGIN_PAGE = "/index"

# Hak akses halaman di Pages/. Halaman lain di Pages/ OTOMATIS khusus admin.
PAGES_DIR = os.path.join(ROOT, "Pages")
PUBLIC_PAGES = {os.path.normcase(n) for n in ("index.html", "forgot.html", "reset.html")}  # siapa saja
MEMBER_PAGES = {
    os.path.normcase(n)
    for n in ("dashboard.html", "buku.html", "pinjaman.html", "profile.html")
}

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
    """Ubah URL jadi path file di frontend/. URL bersih: /Pages/login -> Pages/login.html."""
    try:
        rel = unquote(url_path).lstrip("/")
        if not os.path.splitext(rel)[1]:
            rel += ".html"  # tanpa ekstensi dianggap halaman HTML
        full = os.path.realpath(os.path.join(ROOT, rel))
        common = os.path.commonpath([full, ROOT])
        if os.path.normcase(common) != os.path.normcase(ROOT):
            return None  # keluar dari folder frontend (path traversal)
    except ValueError:
        return None
    if os.path.normcase(full) == os.path.normcase(ROOT_INDEX) and os.path.isfile(full):
        return full
    first = os.path.relpath(full, ROOT).split(os.sep)[0]
    if os.path.normcase(first) not in ALLOWED_DIRS or not os.path.isfile(full):
        return None
    return full


def access_level(full):
    """'public', 'member', atau 'admin' untuk sebuah file."""
    if os.path.normcase(full) == os.path.normcase(ROOT_INDEX):
        return "public"
    folder = os.path.normcase(os.path.dirname(full))
    pages = os.path.normcase(PAGES_DIR)
    if not (folder + os.sep).startswith(pages + os.sep):
        return "public"  # Style, Js, assets
    if folder == pages:
        name = os.path.normcase(os.path.basename(full))
        if name in PUBLIC_PAGES:
            return "public"
        if name in MEMBER_PAGES:
            return "member"
    return "admin"  # default aman: khusus admin


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
                query = urlsplit(self.path).query
                self._redirect(LOGIN_PAGE + ("?" + query if query else ""))
            else:
                self._serve_static(request)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            # Diabaikan karena klien sudah menutup koneksi (misal refresh browser)
            pass
        except Exception:
            traceback.print_exc()
            try:
                error("Terjadi kesalahan pada server", 500).send(self)
            except Exception:
                pass  # Mencegah error susulan jika socket sudah tertutup
    def _current_user(self, request):
        user_id = session.get_user_id(request.cookies.get(session.COOKIE_NAME))
        return User.find_by_id(user_id) if user_id else None

    def _serve_static(self, request):
        full = resolve_static(request.path)
        if full is None:
            error("Tidak ditemukan", 404).send(self)
            return

        # /Pages/index.html -> /Pages/index (query string ikut dibawa)
        if request.path.lower().endswith(".html"):
            query = urlsplit(self.path).query
            self._redirect(request.path[:-5] + ("?" + query if query else ""))
            return

        level = access_level(full)
        if level != "public":
            user = self._current_user(request)
            if user is None:
                self._redirect(LOGIN_PAGE)
                return
            if level == "admin" and user["role"] != "admin":
                error("Anda tidak punya akses", 403).send(self)
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
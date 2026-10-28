import re
import traceback

from core import session
from core.request import BadRequestError
from core.response import error
from models.user import User


def _compile(pattern):
    """Ubah '/api/books/{id}' jadi regex yang menangkap {id}."""
    regex = ""
    for part in re.split(r"(\{\w+\})", pattern):
        if part.startswith("{") and part.endswith("}"):
            regex += f"(?P<{part[1:-1]}>[^/]+)"
        else:
            regex += re.escape(part)
    return re.compile(f"^{regex}$")


class Route:
    def __init__(self, method, pattern, handler, login, roles):
        self.method = method
        self.regex = _compile(pattern)
        self.handler = handler
        self.login = login or bool(roles)  # rute berrole otomatis butuh login
        self.roles = roles


class Router:
    def __init__(self):
        self._routes = []

    def add(self, method, pattern, handler, login=False, roles=None):
        self._routes.append(Route(method.upper(), pattern, handler, login, roles))

    def dispatch(self, request):
        path = request.path.rstrip("/") or "/"
        allowed = []
        for route in self._routes:
            match = route.regex.match(path)
            if not match:
                continue
            if route.method != request.method:
                allowed.append(route.method)
                continue
            request.params = match.groupdict()
            return self._run(route, request)

        if allowed:
            response = error("Method tidak diizinkan", 405)
            response.headers["Allow"] = ", ".join(sorted(set(allowed)))
            return response
        return error("Tidak ditemukan", 404)

    def _run(self, route, request):
        try:
            if route.login:
                user_id = session.get_user_id(request.cookies.get(session.COOKIE_NAME))
                user = User.find_by_id(user_id) if user_id else None
                if user is None:
                    return error("Silakan login terlebih dahulu", 401)
                request.user = user
                if route.roles and user["role"] not in route.roles:
                    return error("Anda tidak punya akses", 403)
            return route.handler(request)
        except BadRequestError as e:
            return error(str(e), 400)
        except Exception:
            traceback.print_exc()
            return error("Terjadi kesalahan pada server", 500)
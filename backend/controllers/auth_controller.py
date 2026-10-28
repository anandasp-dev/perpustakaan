import re

from config import PRODUCTION
from core import session
from core.response import Response, error
from models.user import User, DuplicateUserError
from utils.security import hash_password, verify_password, fake_verify
from views import auth_view

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,50}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8
MAX_PASSWORD = 128


def _text(value):
    """Ambil teks yang sudah dirapikan, selain string dianggap kosong."""
    return value.strip() if isinstance(value, str) else ""


def register(request):
    body = request.json()
    username = _text(body.get("username"))
    email = _text(body.get("email")).lower()
    password = body.get("password")

    if not USERNAME_RE.match(username):
        return error("Username 3-50 karakter: huruf, angka, titik, atau underscore", 400)
    if len(email) > 255 or not EMAIL_RE.match(email):
        return error("Format email tidak valid", 400)
    if not isinstance(password, str) or not (MIN_PASSWORD <= len(password) <= MAX_PASSWORD):
        return error(f"Password harus {MIN_PASSWORD}-{MAX_PASSWORD} karakter", 400)

    try:
        user_id = User.create(username, email, hash_password(password))
    except DuplicateUserError:
        return error("Username atau email sudah terdaftar", 409)

    return Response(201, auth_view.register_ok(User.find_by_id(user_id)))


def login(request):
    body = request.json()
    identifier = _text(body.get("identifier"))
    password = body.get("password")

    if not identifier or not isinstance(password, str) or not password:
        return error("Isi username/email dan password", 400)

    gagal = error("Username/email atau password salah", 401)
    if len(password) > MAX_PASSWORD:
        return gagal

    user = User.find_by_identifier(identifier)
    if user is None:
        fake_verify(password)
        return gagal
    if not verify_password(password, user["password_hash"]):
        return gagal

    session.destroy(request.cookies.get(session.COOKIE_NAME))  # buang sesi lama
    token = session.create(user["id"])
    response = Response(200, auth_view.login_ok(user))
    response.set_cookie(
        session.COOKIE_NAME, token, max_age=session.SESSION_TTL, secure=PRODUCTION
    )
    return response


def logout(request):
    session.destroy(request.cookies.get(session.COOKIE_NAME))
    response = Response(200, auth_view.logout_ok())
    response.clear_cookie(session.COOKIE_NAME)
    return response


def me(request):
    return Response(200, auth_view.me(request.user))
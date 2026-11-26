import re
import time
import traceback

from config import PRODUCTION, APP_BASE_URL
from core import session, reset_store
from core.response import Response, error
from database.db import cursor
from models.user import User, DuplicateUserError
from utils import mailer
from utils.security import hash_password, verify_password, fake_verify
from views import auth_view

# Pakai [0-9], bukan \d, karena \d ikut menerima angka dari aksara lain
NPM_RE = re.compile(r"[0-9]{12}")
PHONE_RE = re.compile(r"08[0-9]{8,11}")  # 08 + 8..11 angka = 10..13 digit
NAME_RE = re.compile(r"[A-Za-z][A-Za-z .'-]{2,99}")  # 3-100 karakter
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8
MAX_PASSWORD = 128

FORGOT_MESSAGE = "Jika email terdaftar, tautan pengaturan ulang password sudah dikirim. Cek juga folder Spam."
BAD_LINK_MESSAGE = "Tautan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru."
FORGOT_COOLDOWN = 60  # detik
_last_forgot = {}  # {user_id: waktu permintaan terakhir}


def _text(value):
    """Ambil teks yang sudah dirapikan, selain string dianggap kosong."""
    return value.strip() if isinstance(value, str) else ""


def _record_daily_login_visit(user):
    """Catat kunjungan daring anggota maksimal 1 kali per hari saat login."""
    if user.get("role") != "member":
        return
    try:
        with cursor() as cur:
            cur.execute(
                "SELECT id FROM kunjungan "
                "WHERE user_id = %s AND visit_date = CURRENT_DATE() "
                "LIMIT 1",
                (user["id"],),
            )
            if cur.fetchone() is None:
                cur.execute(
                    "INSERT INTO kunjungan "
                    "(user_id, visitor_name, visitor_type, visit_date, time_in, purpose) "
                    "VALUES (%s, %s, 'member', CURRENT_DATE(), CURRENT_TIME(), 'Login portal anggota')",
                    (user["id"], user["full_name"]),
                )
    except Exception:
        traceback.print_exc()


def register(request):
    body = request.json()
    full_name = " ".join(_text(body.get("full_name")).split())  # rapikan spasi ganda
    npm = _text(body.get("npm"))
    email = _text(body.get("email")).lower()
    phone = _text(body.get("phone"))
    password = body.get("password")

    if not NAME_RE.fullmatch(full_name):
        return error("Nama lengkap 3-100 karakter: huruf, spasi, titik, apostrof, atau tanda hubung", 400)
    if not NPM_RE.fullmatch(npm):
        return error("NPM harus 12 digit angka", 400)
    if len(email) > 255 or not EMAIL_RE.match(email):
        return error("Format email tidak valid", 400)
    if not PHONE_RE.fullmatch(phone):
        return error("Nomor HP harus diawali 08, hanya angka, 10-13 digit", 400)
    if not isinstance(password, str) or not (MIN_PASSWORD <= len(password) <= MAX_PASSWORD):
        return error(f"Password harus {MIN_PASSWORD}-{MAX_PASSWORD} karakter", 400)

    try:
        user_id = User.create(
            email=email,
            password_hash=hash_password(password),
            npm=npm,
            full_name=full_name,
            phone=phone,
        )
    except DuplicateUserError as e:
        return error(str(e), 409)

    return Response(201, auth_view.register_ok(User.find_by_id(user_id)))


def login(request):
    body = request.json()
    identifier = _text(body.get("identifier"))
    password = body.get("password")

    if not identifier or not isinstance(password, str) or not password:
        return error("Isi NPM/email dan password", 400)

    gagal = error("NPM/email atau password salah", 401)
    if len(password) > MAX_PASSWORD:
        return gagal

    user = User.find_by_identifier(identifier)
    if user is None:
        fake_verify(password)
        return gagal
    if not verify_password(password, user["password_hash"]):
        return gagal

    with cursor() as cur:
        cur.execute("SHOW COLUMNS FROM `user` LIKE 'status'")
        if cur.fetchone() is not None:
            cur.execute("SELECT status FROM `user` WHERE id = %s", (user["id"],))
            st = cur.fetchone()
            if st and st.get("status") == "suspended":
                return error("Akun Anda sedang ditangguhkan. Hubungi petugas perpustakaan.", 403)

    _record_daily_login_visit(user)

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


def forgot(request):
    body = request.json()
    email = _text(body.get("email")).lower()
    if len(email) > 255 or not EMAIL_RE.match(email):
        return error("Format email tidak valid", 400)

    user = User.find_by_email(email)
    now = time.time()
    if user and now - _last_forgot.get(user["id"], 0) >= FORGOT_COOLDOWN:
        _last_forgot[user["id"]] = now
        token = reset_store.create(user["id"])
        link = f"{APP_BASE_URL}/Pages/reset?token={token}"
        try:
            mailer.send_reset_email(user["email"], user["full_name"], link)
        except Exception:
            traceback.print_exc()

    return Response(200, {"message": FORGOT_MESSAGE})


def reset_check(request):
    body = request.json()
    if reset_store.peek(body.get("token")) is None:
        return error(BAD_LINK_MESSAGE, 400)
    return Response(200, {"message": "Tautan valid"})


def reset(request):
    body = request.json()
    token = body.get("token")
    password = body.get("password")

    if not isinstance(password, str) or not (MIN_PASSWORD <= len(password) <= MAX_PASSWORD):
        return error(f"Password harus {MIN_PASSWORD}-{MAX_PASSWORD} karakter", 400)

    user_id = reset_store.consume(token)
    if user_id is None:
        return error(BAD_LINK_MESSAGE, 400)

    User.update_password(user_id, hash_password(password))
    session.destroy_user(user_id)
    return Response(200, {"message": "Password berhasil diubah. Silakan login."})
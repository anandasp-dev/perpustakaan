from controllers.admin_controller import _check_profile   # aturan nama/email/HP yang sama dengan halaman admin
from core.response import Response, error
from database.db import cursor
from models.member import Member, MemberRuleError
from models.user import User
from utils.security import hash_password, verify_password

MIN_PASSWORD = 8
MAX_PASSWORD = 128


def _last_login_for(user_id, fallback_dt):
    with cursor() as cur:
        cur.execute(
            "SELECT created_at FROM kunjungan "
            "WHERE user_id = %s AND purpose = 'Login portal anggota' "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (user_id,),
        )
        row = cur.fetchone()
    if row and row.get("created_at"):
        return row["created_at"]
    return fallback_dt


def _profile_data(row):
    name = row["full_name"]
    prefix = "ADM" if row.get("role") == "admin" else "MB"
    return {
        "id": row["id"],
        "code": f"{prefix}-{row['id']:04d}",
        "name": name,
        "npm": row["npm"],
        "email": row["email"],
        "phone": row["phone"],
        "role": row["role"],
        "program_study" : row["program_study"],
        "status": row.get("status") or "active",
        "created_at": row["created_at"],
        "last_login": _last_login_for(row["id"], row["created_at"]),
        "visits_this_month": row.get("visits_this_month", 0),
    }


def _load_profile(user_id):
    row = Member.profile(user_id)
    if row is not None:
        return row
    return User.find_by_id(user_id)


def get_profile(request):
    row = _load_profile(request.user["id"])
    if row is None:
        return error("Akun tidak ditemukan", 404)
    return Response(200, {"profile": _profile_data(row)})


def update_profile(request):
    profile, problem = _check_profile(request.json())
    if problem:
        return error(problem, 400)

    try:
        Member.update_own(request.user["id"], *profile)
    except MemberRuleError as exc:
        return error(str(exc), 409)

    return Response(200, {"profile": _profile_data(_load_profile(request.user["id"]))})


def change_password(request):
    body = request.json()
    current_pw = body.get("current_password")
    new_pw = body.get("new_password")

    if not isinstance(current_pw, str) or not current_pw:
        return error("Kata sandi saat ini wajib diisi", 400)
    if not isinstance(new_pw, str) or not (MIN_PASSWORD <= len(new_pw) <= MAX_PASSWORD):
        return error(f"Kata sandi baru harus {MIN_PASSWORD}-{MAX_PASSWORD} karakter", 400)

    user_id = request.user["id"]
    with cursor() as cur:
        cur.execute("SELECT password_hash FROM `user` WHERE id = %s", (user_id,))
        row = cur.fetchone()

    if row is None:
        return error("Akun tidak ditemukan", 404)
    if not verify_password(current_pw, row["password_hash"]):
        return error("Kata sandi saat ini salah", 400)

    User.update_password(user_id, hash_password(new_pw))
    return Response(200, {"message": "Kata sandi berhasil diperbarui"})
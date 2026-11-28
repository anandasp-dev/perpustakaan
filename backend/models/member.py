from datetime import datetime
from zoneinfo import ZoneInfo
import mysql.connector

from core import session
from database.db import cursor
from utils.security import hash_password

WIB = ZoneInfo("Asia/Jakarta")


def _today_wib():
    return datetime.now(WIB).date()


class MemberNotFoundError(Exception):
    """Anggota tidak ada."""


class MemberRuleError(Exception):
    """Anggota ada, tapi aturan tidak mengizinkan."""


_STATUS_READY = False


def ensure_status_column():
    """Pastikan kolom `status` dan `deactivated_at` tersedia di tabel `user`."""
    global _STATUS_READY
    if _STATUS_READY:
        return
    with cursor() as cur:
        cur.execute("SHOW COLUMNS FROM `user` LIKE 'status'")
        if cur.fetchone() is None:
            cur.execute(
                "ALTER TABLE `user` "
                "ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER role"
            )
        cur.execute("SHOW COLUMNS FROM `user` LIKE 'deactivated_at'")
        if cur.fetchone() is None:
            cur.execute(
                "ALTER TABLE `user` "
                "ADD COLUMN deactivated_at DATETIME NULL DEFAULT NULL AFTER status"
            )
    _STATUS_READY = True


# urutan yang diizinkan (isi ORDER BY dipilih dari daftar ini, tidak pernah dari kiriman pengguna)
_SORTS = {
    "recent": "v.last_visit IS NULL, v.last_visit DESC, u.id DESC",
    "name": "COALESCE(u.full_name, '') ASC, u.id ASC",
    "borrowed": "loans_total DESC, u.id ASC",
}

# total pinjam = pinjaman yang pernah dikonfirmasi; kunjungan = total catatan kunjungan
_ADMIN_SELECT = (
    "SELECT u.id, u.npm, u.full_name, u.program_study, u.email, u.phone, "
    "u.status, u.deactivated_at, u.created_at, "
    "COALESCE(l.total, 0) AS loans_total, "
    "COALESCE(v.total, 0) AS visits_total, v.last_visit "
    "FROM `user` u "
    "LEFT JOIN (SELECT user_id, COUNT(*) AS total FROM peminjaman "
    "           WHERE status IN ('borrowed', 'returned') GROUP BY user_id) l "
    "ON l.user_id = u.id "
    "LEFT JOIN (SELECT user_id, COUNT(*) AS total, MAX(visit_date) AS last_visit FROM kunjungan "
    "           WHERE user_id IS NOT NULL GROUP BY user_id) v "
    "ON v.user_id = u.id "
)


class Member:
    @staticmethod
    def _get(cur, member_id):
        cur.execute(_ADMIN_SELECT + "WHERE u.id = %s AND u.role = 'member'", (member_id,))
        return cur.fetchone()

    @staticmethod
    def admin_search(q="", status="all", sort="recent", page=1, per_page=8):
        """Daftar anggota untuk halaman admin: dengan pencarian, filter status, urutan, dan halaman."""
        ensure_status_column()
        conditions = ["u.role = 'member'"]
        params = []

        q = q.strip()
        if q:
            like = f"%{q}%"
            parts = ["u.full_name LIKE %s", "u.email LIKE %s", "u.npm LIKE %s"]
            params += [like, like, like]
            code = q.upper().removeprefix("MB-").lstrip("0")   # "MB-0008" -> "8"
            if code.isdigit():
                parts.append("u.id = %s")
                params.append(int(code))
            conditions.append("(" + " OR ".join(parts) + ")")

        if status in ("active", "suspended"):
            conditions.append("u.status = %s")
            params.append(status)

        where = " WHERE " + " AND ".join(conditions)
        order = _SORTS.get(sort, _SORTS["recent"])

        with cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM `user` u" + where, tuple(params))
            total = cur.fetchone()["total"]

            cur.execute(
                _ADMIN_SELECT + where + " ORDER BY " + order + " LIMIT %s OFFSET %s",
                tuple(params) + (per_page, (page - 1) * per_page),
            )
            rows = cur.fetchall()

        return rows, total

    @staticmethod
    def admin_summary():
        """Angka untuk tiga kartu di atas halaman Anggota."""
        ensure_status_column()
        today = _today_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS total, "
                "COALESCE(SUM(u.status = 'suspended'), 0) AS suspended, "
                "COALESCE(SUM(YEAR(created_at) = YEAR(%s) "
                "AND MONTH(created_at) = MONTH(%s)), 0) AS new_month "
                "FROM `user` u WHERE role = 'member'",
                (today, today),
            )
            row = cur.fetchone()
        return {
            "total": row["total"],
            "new_month": int(row["new_month"]),
            "suspended": int(row["suspended"]),
        }

    @staticmethod
    def admin_create(name, npm, email, phone, program_study, password, status="active"):
        ensure_status_column()
        clean_status = status if status in ("active", "suspended") else "active"
        with cursor() as cur:
            cur.execute(
                "SELECT email FROM `user` WHERE npm = %s OR email = %s LIMIT 1",
                (npm, email),
            )
            clash = cur.fetchone()
            if clash is not None:
                if clash["email"] and clash["email"].lower() == email.lower():
                    raise MemberRuleError("Email sudah terdaftar")
                raise MemberRuleError("NPM sudah terdaftar")

            try:
                cur.execute(
                    "INSERT INTO `user` "
                    "(npm, full_name, email, phone, program_study, password_hash, role, status, deactivated_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, 'member', %s, IF(%s = 'active', NULL, NOW()))",
                    (npm, name, email, phone, program_study, hash_password(password), clean_status, clean_status),
                )
            except mysql.connector.Error as exc:
                if exc.errno == 1062:
                    raise MemberRuleError("NPM atau email sudah terdaftar") from exc
                raise
            return Member._get(cur, cur.lastrowid)

    @staticmethod
    def admin_update(member_id, name, email, phone, program_study, status=None):
        ensure_status_column()
        with cursor() as cur:
            cur.execute(
                "SELECT id, status FROM `user` WHERE id = %s AND role = 'member' FOR UPDATE",
                (member_id,),
            )
            existing = cur.fetchone()
            if existing is None:
                raise MemberNotFoundError("Anggota tidak ditemukan")

            cur.execute(
                "SELECT id FROM `user` WHERE email = %s AND id <> %s LIMIT 1",
                (email, member_id),
            )
            if cur.fetchone() is not None:
                raise MemberRuleError("Email sudah dipakai akun lain")

            clean_status = (
                status if status in ("active", "suspended") else existing.get("status", "active")
            )
            cur.execute(
                "UPDATE `user` "
                "SET full_name = %s, email = %s, phone = %s, program_study = %s, status = %s, "
                "deactivated_at = IF(%s = 'active', NULL, COALESCE(deactivated_at, NOW())) "
                "WHERE id = %s",
                (name, email, phone, program_study, clean_status, clean_status, member_id),
            )
            updated = Member._get(cur, member_id)

        if clean_status != "active":
            session.destroy_user(member_id)
        return updated

    @staticmethod
    def admin_delete(member_id):
        """Hapus anggota. Ditolak kalau masih punya pinjaman aktif atau riwayat pengembalian."""
        with cursor() as cur:
            cur.execute(
                "SELECT id FROM `user` WHERE id = %s AND role = 'member' FOR UPDATE",
                (member_id,),
            )
            if cur.fetchone() is None:
                raise MemberNotFoundError("Anggota tidak ditemukan")

            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE user_id = %s AND status IN ('pending', 'borrowed')",
                (member_id,),
            )
            if cur.fetchone()["total"] > 0:
                raise MemberRuleError("Anggota masih memiliki pinjaman aktif atau booking")

            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman WHERE user_id = %s AND status = 'returned'",
                (member_id,),
            )
            if cur.fetchone()["total"] > 0:
                raise MemberRuleError(
                    "Anggota ini punya riwayat peminjaman sehingga tidak bisa dihapus"
                )

            cur.execute(
                "DELETE FROM peminjaman WHERE user_id = %s AND status IN ('cancelled', 'expired')",
                (member_id,),
            )
            cur.execute("DELETE FROM `user` WHERE id = %s", (member_id,))

        session.destroy_user(member_id)

    @staticmethod
    def profile(user_id):
        """Data profil milik satu akun, plus kunjungan bulan ini."""
        today = _today_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT id, npm, full_name, email, phone, program_study, role, status, created_at "
                "FROM `user` WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

            cur.execute(
                "SELECT COUNT(*) AS total FROM kunjungan "
                "WHERE user_id = %s "
                "AND YEAR(visit_date) = YEAR(%s) "
                "AND MONTH(visit_date) = MONTH(%s)",
                (user_id, today, today),
            )
            row["visits_this_month"] = cur.fetchone()["total"]
            return row

    @staticmethod
    def update_own(user_id, name, email, phone, program_study=None):
        """Mengubah profil sendiri: nama, email, HP, dan program_study."""
        with cursor() as cur:
            cur.execute(
                "SELECT id FROM `user` WHERE email = %s AND id <> %s LIMIT 1",
                (email, user_id),
            )
            if cur.fetchone() is not None:
                raise MemberRuleError("Email sudah dipakai akun lain")

            try:
                cur.execute(
                    "UPDATE `user` SET full_name = %s, email = %s, phone = %s, program_study = %s WHERE id = %s",
                    (name, email, phone, program_study, user_id),
                )
            except mysql.connector.Error as exc:
                if exc.errno == 1062:
                    raise MemberRuleError("Email sudah dipakai akun lain") from exc
                raise
import mysql.connector

from database.db import cursor

DUPLICATE_MESSAGES = {
    "npm": "NPM sudah terdaftar",
    "email": "Email sudah terdaftar",
}
DEFAULT_DUPLICATE_MESSAGE = "NPM atau email sudah terdaftar"


class DuplicateUserError(Exception):
    """NPM atau email sudah terdaftar."""

    def __init__(self, message=DEFAULT_DUPLICATE_MESSAGE, field=None):
        super().__init__(message)
        self.field = field  # "npm" / "email" / None


def _duplicate_field(error):
    """Tebak kolom mana yang bentrok dari teks error MySQL 1062."""
    text = str(error).lower()
    if "uq_users_npm" in text or "npm" in text:
        return "npm"
    if "uq_users_email" in text or "email" in text:
        return "email"
    return None


class User:
    @staticmethod
    def create(email, password_hash, role="member",
                 npm=None, full_name=None, phone=None, program_study=None):
        try:
            with cursor() as cur:
                cur.execute(
                    "INSERT INTO `user` "
                    "(npm, full_name, email, phone, password_hash, role, program_study) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (npm, full_name, email, phone, password_hash, role, program_study),
                )
                return cur.lastrowid
        except mysql.connector.Error as e:
            if e.errno == 1062:
                field = _duplicate_field(e)
                raise DuplicateUserError(
                    DUPLICATE_MESSAGES.get(field, DEFAULT_DUPLICATE_MESSAGE),
                    field=field,
                ) from e
            raise

    @staticmethod
    def find_by_id(user_id):
        with cursor() as cur:
            cur.execute(
                "SELECT id, npm, full_name, email, phone, role, status, created_at, program_study "
                "FROM `user` WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()

    @staticmethod
    def find_by_identifier(identifier):
        with cursor() as cur:
            cur.execute(
                "SELECT id, npm, full_name, email, phone, "
                "password_hash, role, status, created_at, program_study "
                "FROM `user` WHERE email = %s OR npm = %s",
                (identifier, identifier),
            )
            return cur.fetchone()

    @staticmethod
    def find_by_email(email):
        with cursor() as cur:
            cur.execute(
                "SELECT id, email, full_name, status FROM `user` WHERE email = %s",
                (email,),
            )
            return cur.fetchone()

    @staticmethod
    def update_password(user_id, password_hash):
        with cursor() as cur:
            cur.execute(
                "UPDATE `user` SET password_hash = %s WHERE id = %s",
                (password_hash, user_id),
            )
            return cur.rowcount

    @staticmethod
    def find_for_admin(text):
        """Cari anggota dari teks yang diketik petugas: NPM, ID anggota (MB-0008),
        atau nama lengkap. Hasil: daftar (kosong = tidak ada, lebih dari 1 = ambigu)."""
        text = text.strip()
        if not text:
            return []
        upper = text.upper()
        member_id = int(upper[3:]) if upper.startswith("MB-") and upper[3:].isdigit() else 0
        with cursor() as cur:
            cur.execute(
                "SELECT id, npm, full_name, status FROM `user` "
                "WHERE role = 'member' "
                "AND (id = %s OR npm = %s OR full_name = %s) "
                "LIMIT 5",
                (member_id, text, text),
            )
            return cur.fetchall()
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from database.db import cursor

WIB = ZoneInfo("Asia/Jakarta")

MAX_DUE_DAYS = 90        # jatuh tempo paling lama 90 hari sejak tanggal pinjam
RENEW_DAYS = 7           # satu kali perpanjangan = tambah 7 hari
MAX_RENEWALS = 1         # boleh diperpanjang berapa kali
LOAN_DAYS = 14           # masa pinjam, dihitung sejak admin mengonfirmasi
MAX_ACTIVE_LOANS = 5     # jatah buku aktif (menunggu konfirmasi + sedang dipinjam)
CONFIRM_HOURS = 24       # batas booking sebelum hangus


def _now_wib():
    return datetime.now(WIB).replace(tzinfo=None)


def _today_wib():
    return datetime.now(WIB).date()


# Kolom yang selalu diambil saat menampilkan pinjaman (digabung dengan data buku).
# confirm_seconds_left = sisa detik sampai booking hangus berdasarkan waktu WIB server.
_LOAN_SELECT = (
    "SELECT p.id, p.user_id, p.book_id, p.borrowed_at, p.due_date, p.confirmed_at, "
    "p.returned_at, p.status, p.renew_count, "
    f"DATE_ADD(p.borrowed_at, INTERVAL {CONFIRM_HOURS} HOUR) AS confirm_deadline, "
    "GREATEST(TIMESTAMPDIFF(SECOND, %s, "
    f"DATE_ADD(p.borrowed_at, INTERVAL {CONFIRM_HOURS} HOUR)), 0) AS confirm_seconds_left, "
    "b.title, b.author, b.category, b.cover "
    "FROM peminjaman p JOIN buku b ON b.id = p.book_id "
)


class LoanNotFoundError(Exception):
    """Buku atau pinjaman tidak ada (atau bukan milik user ini)."""


class LoanRuleError(Exception):
    """Datanya ada, tapi aturan perpustakaan tidak mengizinkan."""


class Loan:
    @staticmethod
    def _select_one(cur, loan_id):
        cur.execute(_LOAN_SELECT + "WHERE p.id = %s", (_now_wib(), loan_id))
        return cur.fetchone()

    @staticmethod
    def find_active_for_user(user_id):
        """Pinjaman aktif milik user: menunggu konfirmasi dan sedang dipinjam."""
        with cursor() as cur:
            cur.execute(
                _LOAN_SELECT
                + "WHERE p.user_id = %s AND p.status IN ('pending', 'borrowed') "
                "ORDER BY p.borrowed_at DESC",
                (_now_wib(), user_id),
            )
            return cur.fetchall()

    @staticmethod
    def set_due_date(loan_id, new_due):
        """Admin mengubah jatuh tempo pinjaman yang sedang dipinjam."""
        with cursor() as cur:
            cur.execute(
                "SELECT id, status, confirmed_at FROM peminjaman WHERE id = %s FOR UPDATE",
                (loan_id,),
            )
            loan = cur.fetchone()

            if loan is None:
                raise LoanNotFoundError("Pinjaman tidak ditemukan")
            if loan["status"] != "borrowed":
                raise LoanRuleError(
                    "Jatuh tempo hanya bisa diubah untuk pinjaman yang sedang dipinjam"
                )

            start = loan["confirmed_at"].date() if loan["confirmed_at"] else _today_wib()
            if new_due < start:
                raise LoanRuleError("Jatuh tempo tidak boleh sebelum tanggal pinjam")
            if new_due > start + timedelta(days=MAX_DUE_DAYS):
                raise LoanRuleError(
                    f"Jatuh tempo paling lama {MAX_DUE_DAYS} hari sejak tanggal pinjam"
                )

            cur.execute(
                "UPDATE peminjaman SET due_date = %s WHERE id = %s",
                (new_due, loan_id),
            )
            return Loan._select_one(cur, loan_id)

    @staticmethod
    def expire_stale():
        """Booking yang lewat CONFIRM_HOURS jam tanpa konfirmasi jadi 'expired', stok kembali."""
        now = _now_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT id, book_id FROM peminjaman "
                "WHERE status = 'pending' "
                f"AND borrowed_at < DATE_SUB(%s, INTERVAL {CONFIRM_HOURS} HOUR) "
                "FOR UPDATE",
                (now,),
            )
            stale = cur.fetchall()
            for row in stale:
                cur.execute(
                    "UPDATE peminjaman SET status = 'expired' WHERE id = %s",
                    (row["id"],),
                )
                cur.execute(
                    "UPDATE buku SET stock = stock + 1 WHERE id = %s",
                    (row["book_id"],),
                )
            return len(stale)

    @staticmethod
    def create(user_id, book_id=None, title=None, confirmed=False, due_date=None):
        """Booking buku (pending, stok langsung berkurang).
        Dengan confirmed=True (dipakai admin di meja layanan) langsung berstatus borrowed,
        jatuh tempo = due_date (bawaan: hari ini + LOAN_DAYS)."""
        now = _now_wib()
        today = now.date()
        with cursor() as cur:
            if book_id is not None:
                cur.execute(
                    "SELECT id, stock FROM buku WHERE id = %s FOR UPDATE",
                    (book_id,),
                )
            elif title:
                cur.execute(
                    "SELECT id, stock FROM buku WHERE title = %s LIMIT 1 FOR UPDATE",
                    (title,),
                )
            else:
                raise ValueError("Buku tidak valid")

            book = cur.fetchone()
            if book is None:
                raise LoanNotFoundError("Buku tidak ditemukan")
            if book["stock"] <= 0:
                raise LoanRuleError("Stok buku tidak tersedia")

            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE user_id = %s AND status IN ('pending', 'borrowed')",
                (user_id,),
            )
            if cur.fetchone()["total"] >= MAX_ACTIVE_LOANS:
                raise LoanRuleError(f"Maksimal peminjaman {MAX_ACTIVE_LOANS} buku aktif")

            cur.execute(
                "SELECT id FROM peminjaman "
                "WHERE user_id = %s AND book_id = %s AND status IN ('pending', 'borrowed')",
                (user_id, book["id"]),
            )
            if cur.fetchone() is not None:
                raise LoanRuleError("Buku ini sedang dipinjam atau dibooking oleh anggota yang sama")

            cur.execute(
                "UPDATE buku SET stock = stock - 1 WHERE id = %s",
                (book["id"],),
            )
            if confirmed:
                due = due_date or (today + timedelta(days=LOAN_DAYS))
                cur.execute(
                    "INSERT INTO peminjaman (user_id, book_id, status, borrowed_at, confirmed_at, due_date) "
                    "VALUES (%s, %s, 'borrowed', %s, %s, %s)",
                    (user_id, book["id"], now, now, due),
                )
            else:
                cur.execute(
                    "INSERT INTO peminjaman (user_id, book_id, status, borrowed_at) "
                    "VALUES (%s, %s, 'pending', %s)",
                    (user_id, book["id"], now),
                )
            return Loan._select_one(cur, cur.lastrowid)

    @staticmethod
    def cancel(user_id, loan_id):
        """Member membatalkan booking selama masih pending: stok kembali."""
        with cursor() as cur:
            cur.execute(
                "SELECT id, book_id, status FROM peminjaman "
                "WHERE id = %s AND user_id = %s FOR UPDATE",
                (loan_id, user_id),
            )
            loan = cur.fetchone()

            if loan is None:
                raise LoanNotFoundError("Pinjaman tidak ditemukan")
            if loan["status"] == "expired":
                raise LoanRuleError("Booking sudah hangus karena lewat 24 jam")
            if loan["status"] != "pending":
                raise LoanRuleError(
                    "Hanya pinjaman yang menunggu konfirmasi yang bisa dibatalkan"
                )

            cur.execute(
                "UPDATE peminjaman SET status = 'cancelled' WHERE id = %s",
                (loan_id,),
            )
            cur.execute(
                "UPDATE buku SET stock = stock + 1 WHERE id = %s",
                (loan["book_id"],),
            )
            return Loan._select_one(cur, loan_id)

    @staticmethod
    def confirm(loan_id):
        """Admin mengonfirmasi booking: pending -> borrowed, masa pinjam mulai dihitung."""
        now = _now_wib()
        due = now.date() + timedelta(days=LOAN_DAYS)
        with cursor() as cur:
            cur.execute(
                "SELECT id, status FROM peminjaman WHERE id = %s FOR UPDATE",
                (loan_id,),
            )
            loan = cur.fetchone()

            if loan is None:
                raise LoanNotFoundError("Pinjaman tidak ditemukan")
            if loan["status"] == "expired":
                raise LoanRuleError("Booking sudah hangus karena lewat 24 jam")
            if loan["status"] == "cancelled":
                raise LoanRuleError("Booking sudah dibatalkan oleh anggota")
            if loan["status"] != "pending":
                raise LoanRuleError("Pinjaman ini sudah dikonfirmasi sebelumnya")

            cur.execute(
                "UPDATE peminjaman "
                "SET status = 'borrowed', confirmed_at = %s, due_date = %s "
                "WHERE id = %s",
                (now, due, loan_id),
            )
            return Loan._select_one(cur, loan_id)

    @staticmethod
    def renew(user_id, loan_id):
        """Perpanjang satu pinjaman milik user: jatuh tempo + RENEW_DAYS hari."""
        today = _today_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT id, status, due_date, renew_count FROM peminjaman "
                "WHERE id = %s AND user_id = %s FOR UPDATE",
                (loan_id, user_id),
            )
            loan = cur.fetchone()

            if loan is None:
                raise LoanNotFoundError("Pinjaman tidak ditemukan")
            if loan["status"] == "pending":
                raise LoanRuleError("Pinjaman belum dikonfirmasi admin")
            if loan["status"] != "borrowed":
                raise LoanRuleError("Pinjaman ini sudah tidak aktif")
            if loan["renew_count"] >= MAX_RENEWALS:
                raise LoanRuleError(f"Pinjaman ini sudah diperpanjang {MAX_RENEWALS} kali")
            if loan["due_date"] < today:
                raise LoanRuleError(
                    "Pinjaman sudah lewat jatuh tempo, silakan hubungi petugas perpustakaan"
                )

            cur.execute(
                "UPDATE peminjaman "
                "SET due_date = DATE_ADD(due_date, INTERVAL %s DAY), "
                "renew_count = renew_count + 1 "
                "WHERE id = %s",
                (RENEW_DAYS, loan_id),
            )
            return Loan._select_one(cur, loan_id)

    @staticmethod
    def count_this_month(user_id):
        """Berapa pinjaman user yang dikonfirmasi di bulan berjalan (WIB)."""
        today = _today_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE user_id = %s AND status IN ('borrowed', 'returned') "
                "AND YEAR(confirmed_at) = YEAR(%s) "
                "AND MONTH(confirmed_at) = MONTH(%s)",
                (user_id, today, today),
            )
            return cur.fetchone()["total"]

    @staticmethod
    def mark_returned(loan_id):
        """Admin menerima buku kembali: borrowed -> returned, stok bertambah."""
        now = _now_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT id, book_id, status FROM peminjaman WHERE id = %s FOR UPDATE",
                (loan_id,),
            )
            loan = cur.fetchone()

            if loan is None:
                raise LoanNotFoundError("Pinjaman tidak ditemukan")
            if loan["status"] == "pending":
                raise LoanRuleError("Pinjaman belum dikonfirmasi, konfirmasi dulu sebelum dikembalikan")
            if loan["status"] == "returned":
                raise LoanRuleError("Pinjaman ini sudah dikembalikan")
            if loan["status"] != "borrowed":
                raise LoanRuleError("Pinjaman ini sudah dibatalkan atau hangus")

            cur.execute(
                "UPDATE peminjaman SET status = 'returned', returned_at = %s WHERE id = %s",
                (now, loan_id),
            )
            cur.execute(
                "UPDATE buku SET stock = stock + 1 WHERE id = %s",
                (loan["book_id"],),
            )
            return Loan._select_one(cur, loan_id)

    @staticmethod
    def admin_search(status="all", q="", period="all", page=1, per_page=8):
        """Daftar transaksi untuk halaman admin: dengan pencarian, filter, dan halaman."""
        today = _today_wib()
        conditions = []
        params = []

        # "Terlambat" dan "Dipinjam" dipisah berdasarkan jatuh tempo (WIB)
        if status == "overdue":
            conditions.append("p.status = 'borrowed' AND p.due_date < %s")
            params.append(today)
        elif status == "borrowed":
            conditions.append("p.status = 'borrowed' AND p.due_date >= %s")
            params.append(today)
        elif status in ("pending", "returned", "cancelled", "expired"):
            conditions.append("p.status = %s")
            params.append(status)

        q = q.strip()
        if q:
            like = f"%{q}%"
            parts = ["u.full_name LIKE %s", "u.npm LIKE %s", "b.title LIKE %s"]
            params.extend([like, like, like])
            code = q.upper().removeprefix("PN-").lstrip("0")   # "PN-0008" -> "8"
            if code.isdigit():
                parts.append("p.id = %s")
                params.append(int(code))
            conditions.append("(" + " OR ".join(parts) + ")")

        if period == "today":
            conditions.append("DATE(p.borrowed_at) = %s")
            params.append(today)
        elif period == "week":
            conditions.append("YEARWEEK(p.borrowed_at, 1) = YEARWEEK(%s, 1)")
            params.append(today)
        elif period == "month":
            conditions.append(
                "YEAR(p.borrowed_at) = YEAR(%s) "
                "AND MONTH(p.borrowed_at) = MONTH(%s)"
            )
            params.extend([today, today])

        where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        base = (
            "FROM peminjaman p "
            "JOIN buku b ON b.id = p.book_id "
            "JOIN `user` u ON u.id = p.user_id"
        )

        with cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total " + base + where, tuple(params))
            total = cur.fetchone()["total"]

            cur.execute(
                "SELECT p.id, p.user_id, p.book_id, p.status, p.borrowed_at, p.confirmed_at, "
                "p.due_date, p.returned_at, b.title, u.full_name, u.phone "
                + base + where
                + " ORDER BY p.borrowed_at DESC, p.id DESC LIMIT %s OFFSET %s",
                tuple(params) + (per_page, (page - 1) * per_page),
            )
            rows = cur.fetchall()

        return rows, total

    @staticmethod
    def admin_summary():
        """Angka untuk kartu ringkasan di atas halaman Peminjaman admin (WIB)."""
        today = _today_wib()
        with cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(status = 'borrowed'), 0) AS borrowed, "
                "COALESCE(SUM(status = 'pending'), 0) AS pending, "
                "COALESCE(SUM(status = 'borrowed' AND due_date < %s), 0) AS overdue, "
                "COALESCE(SUM(status = 'returned' AND DATE(returned_at) = %s), 0) "
                "AS returned_today "
                "FROM peminjaman",
                (today, today),
            )
            row = cur.fetchone()
        return {key: int(value) for key, value in row.items()}

    @staticmethod
    def find_history_for_user(user_id, limit=10):
        """Riwayat pengembalian milik user (terbaru dulu)."""
        with cursor() as cur:
            cur.execute(
                _LOAN_SELECT
                + "WHERE p.user_id = %s AND p.status = 'returned' "
                "ORDER BY p.returned_at DESC, p.id DESC LIMIT %s",
                (_now_wib(), user_id, limit),
            )
            return cur.fetchall()
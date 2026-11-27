from datetime import date, datetime, time, timedelta

from database.db import cursor
from models.loan import CONFIRM_HOURS

WINDOW_DAYS = 14      # kejadian yang lebih lama dari ini tidak ditampilkan
MAX_ITEMS = 20
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _tgl(d):
    return f"{d.day:02d} {BULAN[d.month - 1]} {d.year}"


def _tgl_jam(dt):
    return f"{dt.day:02d} {BULAN[dt.month - 1]} {dt.hour:02d}:{dt.minute:02d}"


class Notification:
    @staticmethod
    def for_user(user_id):
        """Susun notifikasi dari kondisi pinjaman milik user. Hasil: (daftar, jumlah belum dibaca)."""
        today = date.today()
        now = datetime.now()
        limit = now - timedelta(days=WINDOW_DAYS)

        with cursor() as cur:
            cur.execute("SELECT notif_seen_at FROM `user` WHERE id = %s", (user_id,))
            row = cur.fetchone()
            seen_at = row["notif_seen_at"] if row else None

            cur.execute(
                "SELECT p.id, p.status, p.borrowed_at, p.confirmed_at, p.due_date, p.returned_at, "
                "b.title "
                "FROM peminjaman p JOIN buku b ON b.id = p.book_id "
                "WHERE p.user_id = %s "
                "AND (p.status IN ('pending', 'borrowed') "
                "     OR COALESCE(p.returned_at, p.borrowed_at) >= DATE_SUB(NOW(), INTERVAL %s DAY)) "
                "ORDER BY p.id DESC",
                (user_id, WINDOW_DAYS),
            )
            loans = cur.fetchall()

        items = []

        def add(kind, loan, when, level, icon, title, message):
            items.append({
                "id": f"{kind}-{loan['id']}",
                "kind": kind,
                "level": level,        # info / neutral / danger (warna ikon)
                "icon": icon,
                "title": title,
                "message": message,
                "time": when,
                "unread": seen_at is None or when > seen_at,
            })

        for loan in loans:
            name = loan["title"]
            number = f"PN-{loan['id']:04d}"
            status = loan["status"]

            if status == "pending":
                deadline = loan["borrowed_at"] + timedelta(hours=CONFIRM_HOURS)
                add("pending", loan, loan["borrowed_at"], "neutral", "clock",
                    "Booking menunggu konfirmasi",
                    f"{name}: tunjukkan nomor {number} ke resepsionis sebelum {_tgl_jam(deadline)}.")

            elif status == "borrowed":
                if loan["confirmed_at"] and loan["confirmed_at"] >= limit:
                    add("confirmed", loan, loan["confirmed_at"], "info", "book",
                        "Peminjaman dikonfirmasi",
                        f"{name} resmi dipinjam. Jatuh tempo {_tgl(loan['due_date'])}.")

                days_left = (loan["due_date"] - today).days
                if days_left < 0:
                    add("overdue", loan,
                        datetime.combine(loan["due_date"] + timedelta(days=1), time.min),
                        "danger", "alert", "Buku terlambat dikembalikan",
                        f"{name} terlambat {-days_left} hari. Segera kembalikan ke perpustakaan.")
                elif days_left <= 1:
                    kapan = "hari ini" if days_left == 0 else "besok"
                    add("due_soon", loan,
                        datetime.combine(loan["due_date"] - timedelta(days=1), time.min),
                        "info", "clock", "Peminjaman hampir jatuh tempo",
                        f"{name} jatuh tempo {kapan} ({_tgl(loan['due_date'])}).")

            elif status == "returned":
                add("returned", loan, loan["returned_at"], "info", "book",
                    "Buku dikembalikan",
                    f"{name} sudah tercatat kembali. Terima kasih!")

            elif status == "expired":
                add("expired", loan, loan["borrowed_at"] + timedelta(hours=CONFIRM_HOURS),
                    "danger", "alert", "Booking hangus",
                    f"Booking {name} dibatalkan otomatis karena tidak dikonfirmasi dalam "
                    f"{CONFIRM_HOURS} jam. Stok sudah dikembalikan.")

        items.sort(key=lambda item: item["time"], reverse=True)
        items = items[:MAX_ITEMS]
        unread = sum(1 for item in items if item["unread"])
        return items, unread

    @staticmethod
    def mark_seen(user_id):
        """Tandai semua notifikasi sebagai sudah dibaca (sampai saat ini)."""
        with cursor() as cur:
            cur.execute("UPDATE `user` SET notif_seen_at = NOW() WHERE id = %s", (user_id,))
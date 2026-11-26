from datetime import timedelta
from utils.text import initials
from database.db import cursor

CHART_DAYS = 7        # grafik 7 hari, berakhir di tanggal acuan
TOP_BORROWERS = 4     # jumlah baris "Peminjam paling aktif" & "Pengunjung paling aktif"
RECENT_LOANS = 5      # jumlah baris "Peminjaman terbaru"


class Stats:
    @staticmethod
    def dashboard(ref):
        """Semua angka dashboard admin. `ref` = tanggal acuan (objek date), biasanya hari ini."""
        week_ago = ref - timedelta(days=7)

        with cursor() as cur:
            # buku: jumlah judul dan eksemplar yang sudah ada sampai tanggal acuan
            cur.execute(
                "SELECT COUNT(*) AS titles, COALESCE(SUM(stock), 0) AS available "
                "FROM buku WHERE DATE(created_at) <= %s",
                (ref,),
            )
            books = cur.fetchone()

            # peminjaman saat ini: sedang dipinjam, menunggu konfirmasi, terlambat
            cur.execute(
                "SELECT COALESCE(SUM(status = 'borrowed'), 0) AS borrowed, "
                "COALESCE(SUM(status = 'pending'), 0) AS pending, "
                "COALESCE(SUM(status = 'borrowed' AND due_date < CURRENT_DATE()), 0) AS overdue "
                "FROM peminjaman"
            )
            loans = cur.fetchone()

            # anggota: total yang sudah terdaftar sampai tanggal acuan, dan yang mendaftar di bulan acuan
            cur.execute(
                "SELECT COUNT(*) AS total, "
                "COALESCE(SUM(YEAR(created_at) = YEAR(%s) AND MONTH(created_at) = MONTH(%s)), 0) "
                "AS new_month "
                "FROM `user` WHERE role = 'member' AND DATE(created_at) <= %s",
                (ref, ref, ref),
            )
            members = cur.fetchone()

            # jumlah pinjaman dikonfirmasi per hari, dari 7 hari sebelum acuan sampai acuan
            cur.execute(
                "SELECT DATE(confirmed_at) AS day, COUNT(*) AS total FROM peminjaman "
                "WHERE status IN ('borrowed', 'returned') "
                "AND DATE(confirmed_at) BETWEEN %s AND %s "
                "GROUP BY DATE(confirmed_at)",
                (week_ago, ref),
            )
            per_day = {row["day"]: row["total"] for row in cur.fetchall()}

            # jumlah pengunjung tercatat per hari, dari 7 hari sebelum acuan sampai acuan
            cur.execute(
                "SELECT DATE(visit_date) AS day, COUNT(*) AS total FROM kunjungan "
                "WHERE status = 'recorded' "
                "AND DATE(visit_date) BETWEEN %s AND %s "
                "GROUP BY DATE(visit_date)",
                (week_ago, ref),
            )
            visits_day = {row["day"]: row["total"] for row in cur.fetchall()}

            # buku yang dikembalikan pada tanggal acuan
            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE status = 'returned' AND DATE(returned_at) = %s",
                (ref,),
            )
            returned_today = cur.fetchone()["total"]

            # anggota paling aktif meminjam di bulan tanggal acuan
            cur.execute(
                "SELECT u.id, u.full_name, COUNT(*) AS total "
                "FROM peminjaman p JOIN `user` u ON u.id = p.user_id "
                "WHERE p.status IN ('borrowed', 'returned') "
                "AND YEAR(p.confirmed_at) = YEAR(%s) AND MONTH(p.confirmed_at) = MONTH(%s) "
                "GROUP BY u.id, u.full_name "
                "ORDER BY total DESC, u.id "
                "LIMIT %s",
                (ref, ref, TOP_BORROWERS),
            )
            top_rows = cur.fetchall()

            # pengunjung paling aktif pada bulan tanggal acuan
            cur.execute(
                "SELECT u.id, u.full_name, COUNT(*) AS total "
                "FROM kunjungan k JOIN `user` u ON u.id = k.user_id "
                "WHERE k.status = 'recorded' AND k.user_id IS NOT NULL "
                "AND YEAR(k.visit_date) = YEAR(%s) AND MONTH(k.visit_date) = MONTH(%s) "
                "GROUP BY u.id, u.full_name "
                "ORDER BY total DESC, u.id "
                "LIMIT %s",
                (ref, ref, TOP_BORROWERS),
            )
            top_visit_rows = cur.fetchall()

            # transaksi terbaru (termasuk yang masih menunggu konfirmasi)
            cur.execute(
                "SELECT p.id, p.status, p.borrowed_at, p.confirmed_at, p.due_date, "
                "b.title, u.full_name "
                "FROM peminjaman p "
                "JOIN buku b ON b.id = p.book_id "
                "JOIN `user` u ON u.id = p.user_id "
                "WHERE p.status IN ('pending', 'borrowed', 'returned') "
                "ORDER BY p.borrowed_at DESC, p.id DESC "
                "LIMIT %s",
                (RECENT_LOANS,),
            )
            recent_rows = cur.fetchall()

            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE status IN ('pending', 'borrowed', 'returned')"
            )
            recent_total = cur.fetchone()["total"]

        available = int(books["available"])
        borrowed = int(loans["borrowed"])
        pending = int(loans["pending"])

        days = [ref - timedelta(days=n) for n in range(CHART_DAYS - 1, -1, -1)]

        top = [
            {
                "member_id": f"MB-{row['id']:04d}",
                "name": row["full_name"],
                "initials": initials(row["full_name"]),
                "total": row["total"],
            }
            for row in top_rows
        ]

        top_visitors = [
            {
                "member_id": f"MB-{row['id']:04d}",
                "name": row["full_name"],
                "initials": initials(row["full_name"]),
                "total": row["total"],
            }
            for row in top_visit_rows
        ]

        recent = [
            {
                "id": row["id"],
                "borrower": row["full_name"],
                "title": row["title"],
                "status": row["status"],
                "loaned_at": row["confirmed_at"] or row["borrowed_at"],
                "due_date": row["due_date"],
            }
            for row in recent_rows
        ]

        return {
            "date": ref,
            "visitors_today": visits_day.get(ref, 0),
            "visitors_last_week": visits_day.get(week_ago, 0),
            "visitors_per_day": [{"date": d, "total": visits_day.get(d, 0)} for d in days],
            "borrowed_today": per_day.get(ref, 0),
            "borrowed_last_week": per_day.get(week_ago, 0),
            "returned_today": returned_today,
            "unique_titles": books["titles"],
            "total_copies": available + borrowed + pending,
            "active_members": members["total"],
            "new_members_month": int(members["new_month"]),
            "overdue": int(loans["overdue"]),
            "collection": {
                "available": available,
                "borrowed": borrowed,
                "pending": pending,
            },
            "borrowed_per_day": [{"date": d, "total": per_day.get(d, 0)} for d in days],
            "top_borrowers": top,
            "top_visitors": top_visitors,
            "recent_loans": recent,
            "recent_total": recent_total,
        }
    @staticmethod
    def reports(start_date, end_date, today):
        """Agregasi data laporan sesuai rentang tanggal `start_date` s/d `end_date`."""
        span_days = (end_date - start_date).days + 1
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span_days - 1)

        with cursor() as cur:
            # 1. Peminjaman dikonfirmasi per hari dalam periode
            cur.execute(
                "SELECT DATE(confirmed_at) AS day, COUNT(*) AS total "
                "FROM peminjaman "
                "WHERE status IN ('borrowed', 'returned') "
                "AND DATE(confirmed_at) BETWEEN %s AND %s "
                "GROUP BY DATE(confirmed_at)",
                (start_date, end_date),
            )
            loans_map = {row["day"]: int(row["total"]) for row in cur.fetchall()}

            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE status IN ('borrowed', 'returned') "
                "AND DATE(confirmed_at) BETWEEN %s AND %s",
                (prev_start, prev_end),
            )
            prev_loans = int(cur.fetchone()["total"])

            # 2. Kunjungan tercatat per hari dalam periode
            cur.execute(
                "SELECT DATE(visit_date) AS day, COUNT(*) AS total "
                "FROM kunjungan "
                "WHERE status = 'recorded' "
                "AND DATE(visit_date) BETWEEN %s AND %s "
                "GROUP BY DATE(visit_date)",
                (start_date, end_date),
            )
            visits_map = {row["day"]: int(row["total"]) for row in cur.fetchall()}

            cur.execute(
                "SELECT COUNT(*) AS total FROM kunjungan "
                "WHERE status = 'recorded' "
                "AND DATE(visit_date) BETWEEN %s AND %s",
                (prev_start, prev_end),
            )
            prev_visits = int(cur.fetchone()["total"])

            # 3. Pengembalian per hari dalam periode
            cur.execute(
                "SELECT DATE(returned_at) AS day, COUNT(*) AS total "
                "FROM peminjaman "
                "WHERE status = 'returned' AND returned_at IS NOT NULL "
                "AND DATE(returned_at) BETWEEN %s AND %s "
                "GROUP BY DATE(returned_at)",
                (start_date, end_date),
            )
            returns_map = {row["day"]: int(row["total"]) for row in cur.fetchall()}

            cur.execute(
                "SELECT COUNT(*) AS total FROM peminjaman "
                "WHERE status = 'returned' AND returned_at IS NOT NULL "
                "AND DATE(returned_at) BETWEEN %s AND %s",
                (prev_start, prev_end),
            )
            prev_returns = int(cur.fetchone()["total"])

            # 4. Status koleksi buku yang sudah terdaftar sampai `end_date`
            cur.execute(
                "SELECT COUNT(*) AS titles, "
                "COALESCE(SUM(stock), 0) AS current_stock, "
                "COALESCE(SUM(CASE WHEN DATE(created_at) = %s THEN stock ELSE 0 END), 0) AS added_on_end "
                "FROM buku WHERE DATE(created_at) <= %s",
                (end_date, end_date),
            )
            book_row = cur.fetchone()

            # Buku yang masih dipinjam pada posisi `end_date` & mutasi pada `end_date`
            cur.execute(
                "SELECT "
                "COALESCE(SUM(p.status IN ('borrowed', 'returned') "
                "  AND DATE(p.confirmed_at) <= %s "
                "  AND (p.returned_at IS NULL OR DATE(p.returned_at) > %s)), 0) AS borrowed_at_end, "
                "COALESCE(SUM(p.status IN ('borrowed', 'returned') "
                "  AND DATE(p.confirmed_at) > %s "
                "  AND DATE(b.created_at) <= %s), 0) AS borrowed_after_end, "
                "COALESCE(SUM(p.status IN ('borrowed', 'returned') "
                "  AND DATE(p.confirmed_at) = %s), 0) AS out_on_end, "
                "COALESCE(SUM(p.status = 'returned' "
                "  AND DATE(p.returned_at) = %s), 0) AS in_on_end "
                "FROM peminjaman p "
                "JOIN buku b ON b.id = p.book_id",
                (end_date, end_date, end_date, end_date, end_date, end_date),
            )
            loan_book_row = cur.fetchone()

            # 5. Keanggotaan yang sudah terdaftar sampai `end_date`
            cur.execute(
                "SELECT COUNT(*) AS total, "
                "COALESCE(SUM(COALESCE(status, 'active') = 'active'), 0) AS active, "
                "COALESCE(SUM(status = 'suspended'), 0) AS suspended, "
                "COALESCE(SUM(DATE(created_at) BETWEEN %s AND %s), 0) AS new_period "
                "FROM `user` WHERE role = 'member' AND DATE(created_at) <= %s",
                (start_date, end_date, end_date),
            )
            member_row = cur.fetchone()

        days = [start_date + timedelta(days=i) for i in range(span_days)]
        daily = [
            {
                "date": str(d),
                "loans": loans_map.get(d, 0),
                "visits": visits_map.get(d, 0),
                "returns": returns_map.get(d, 0),
            }
            for d in days
        ]

        total_loans = sum(x["loans"] for x in daily)
        total_visits = sum(x["visits"] for x in daily)
        total_returns = sum(x["returns"] for x in daily)

        borrowed = int(loan_book_row["borrowed_at_end"])
        # Stok tersedia pada `end_date` = stok sekarang + yang dipinjam setelah `end_date`
        available = int(book_row["current_stock"]) + int(loan_book_row["borrowed_after_end"])
        maintenance = 0
        added_end = int(book_row["added_on_end"])
        out_end = int(loan_book_row["out_on_end"])
        in_end = int(loan_book_row["in_on_end"])

        total_members = int(member_row["total"])
        active_members = int(member_row["active"])
        suspended_members = int(member_row["suspended"])

        return {
            "start_date": str(start_date),
            "end_date": str(end_date),
            "days_count": span_days,
            "generated_at": str(today),
            "totals": {
                "loans": total_loans,
                "prev_loans": prev_loans,
                "visits": total_visits,
                "prev_visits": prev_visits,
                "returns": total_returns,
                "prev_returns": prev_returns,
            },
            "daily": daily,
            "collection": {
                "titles": int(book_row["titles"]),
                "total_copies": available + borrowed + maintenance,
                "available": available,
                "borrowed": borrowed,
                "maintenance": maintenance,
                "added_today": added_end,
                "out_today": out_end,
                "net_today": added_end + in_end - out_end,
            },
            "members": {
                "total": total_members,
                "active": active_members,
                "suspended": suspended_members,
                "new_in_period": int(member_row["new_period"]),
            },
        }
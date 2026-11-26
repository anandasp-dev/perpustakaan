from datetime import date, datetime, timedelta
from math import ceil
import re
from zoneinfo import ZoneInfo

from controllers.loan_controller import loan_data
from core.response import Response, error
from models.book import CATEGORIES, Book, BookNotFoundError, BookRuleError
from models.loan import MAX_DUE_DAYS, Loan, LoanNotFoundError, LoanRuleError
from models.member import Member, MemberNotFoundError, MemberRuleError
from models.stats import Stats
from models.user import User
from utils.files import CoverError, delete_cover_file, save_cover
from utils.text import initials

WIB = ZoneInfo("Asia/Jakarta")
PER_PAGE = 8   # transaksi per halaman, sesuai tulisan di desain
BOOKS_PER_PAGE = 8
MEMBERS_PER_PAGE = 8

# huruf (termasuk beraksen), spasi, titik, apostrof, tanda hubung; 3-100 karakter
NAME_RE = re.compile(r"(?:[^\W\d_]|[ .'\-]){3,100}")
NPM_RE = re.compile(r"[0-9]{12}")
PHONE_RE = re.compile(r"08[0-9]{8,11}")
EMAIL_RE = re.compile(r"[^@\s]{1,64}@[^@\s]+\.[^@\s]+")


def _now_wib():
    return datetime.now(WIB).replace(tzinfo=None)


def _today_wib():
    return datetime.now(WIB).date()


def _member_row(row):
    name = row["full_name"]
    return {
        "id": row["id"],
        "code": f"MB-{row['id']:04d}",
        "name": name,
        "initials": initials(name),
        "npm": row["npm"],
        "email": row["email"],
        "phone": row["phone"],
        "loans_total": row["loans_total"],
        "visits_total": row["visits_total"],
        "last_visit": row["last_visit"],
        "status": row.get("status") or "active",
    }


def _check_profile(body):
    """Periksa nama, email, HP. Hasil: ((nama, email, hp), None) atau (None, pesan)."""
    name = " ".join(str(body.get("name") or "").split())
    email = str(body.get("email") or "").strip()
    phone = str(body.get("phone") or "").replace(" ", "").replace("-", "")

    if not NAME_RE.fullmatch(name):
        return None, "Nama 3-100 karakter: huruf, spasi, titik, apostrof, dan tanda hubung"
    if len(email) > 255 or not EMAIL_RE.fullmatch(email):
        return None, "Format email tidak valid"
    if phone and not PHONE_RE.fullmatch(phone):
        return None, "Nomor HP harus diawali 08 dan 10-13 digit angka"
    return (name, email, phone or None), None


def _check_member_status(raw):
    val = str(raw or "active").strip().lower()
    if val in ("inactive", "suspended"):
        return "suspended"
    if val == "active":
        return "active"
    return None


def members(request):
    q = request.query.get("q", "")
    status = request.query.get("status", "all")
    sort = request.query.get("sort", "recent")
    raw_page = request.query.get("page", "1")
    page = int(raw_page) if raw_page.isdigit() and int(raw_page) > 0 else 1

    rows, total = Member.admin_search(q, status, sort, page, MEMBERS_PER_PAGE)
    return Response(200, {
        "members": [_member_row(row) for row in rows],
        "total": total,
        "page": page,
        "per_page": MEMBERS_PER_PAGE,
        "pages": max(1, ceil(total / MEMBERS_PER_PAGE)),
        "summary": Member.admin_summary(),
    })


def create_member(request):
    body = request.json()
    profile, problem = _check_profile(body)
    if problem:
        return error(problem, 400)

    npm = str(body.get("npm") or "").strip()
    password = str(body.get("password") or "")
    if not NPM_RE.fullmatch(npm):
        return error("NPM harus 12 digit angka", 400)
    if not 8 <= len(password) <= 128:
        return error("Kata sandi 8-128 karakter", 400)

    try:
        row = Member.admin_create(profile[0], npm, profile[1], profile[2], password, status="active")
        return Response(201, {"member": _member_row(row)})
    except MemberRuleError as exc:
        return error(str(exc), 409)

def update_member(request):
    member_id = _path_id(request)
    if member_id is None:
        return error("Anggota tidak ditemukan", 404)

    body = request.json()
    profile, problem = _check_profile(body)
    if problem:
        return error(problem, 400)

    status = _check_member_status(body.get("status")) if "status" in body else None
    if "status" in body and status is None:
        return error("Status keanggotaan tidak valid", 400)

    try:
        row = Member.admin_update(member_id, *profile, status=status)
        return Response(200, {"member": _member_row(row)})
    except MemberNotFoundError as exc:
        return error(str(exc), 404)
    except MemberRuleError as exc:
        return error(str(exc), 409)


def delete_member(request):
    member_id = _path_id(request)
    if member_id is None:
        return error("Anggota tidak ditemukan", 404)

    Loan.expire_stale()
    try:
        Member.admin_delete(member_id)
        return Response(200, {"message": "Anggota dihapus"})
    except MemberNotFoundError as exc:
        return error(str(exc), 404)
    except MemberRuleError as exc:
        return error(str(exc), 409)


def _path_id(request):
    raw = request.params.get("id", "")
    return int(raw) if raw.isdigit() else None


def _canonical_category(text):
    """'self-growth' / 'SELF-GROWTH' -> 'Self-growth'. Tidak dikenal -> None."""
    for name in CATEGORIES:
        if name.lower() == str(text).strip().lower():
            return name
    return None


def _book_row(row):
    available = row["stock"]
    return {
        "id": row["id"],
        "code": f"BK-{row['id']:03d}",
        "title": row["title"],
        "author": row["author"],
        "category": row["category"],
        "cover": row["cover"],
        "total": available + row["active"],
        "available": available,
        "status": "available" if available > 0 else "on-loan",
    }


def _book_fields(body):
    """Periksa isian buku. Hasil: ((judul, penulis, kategori, total), None) atau (None, pesan)."""
    title = str(body.get("title") or "").strip()
    author = str(body.get("author") or "").strip()
    category = _canonical_category(body.get("category") or "")
    try:
        total = int(body.get("total"))
    except (TypeError, ValueError):
        total = -1

    if not title or len(title) > 255:
        return None, "Judul wajib diisi (maksimal 255 karakter)"
    if not author or len(author) > 255:
        return None, "Penulis wajib diisi (maksimal 255 karakter)"
    if category is None:
        return None, "Kategori tidak valid"
    if not 0 <= total <= 9999:
        return None, "Stok harus berupa angka 0 sampai 9999"
    return (title, author, category, total), None


def books(request):
    Loan.expire_stale()

    q = request.query.get("q", "")
    category = _canonical_category(request.query.get("category", "")) or "all"
    status = request.query.get("status", "all")
    raw_page = request.query.get("page", "1")
    page = int(raw_page) if raw_page.isdigit() and int(raw_page) > 0 else 1

    rows, total = Book.admin_search(q, category, status, page, BOOKS_PER_PAGE)
    return Response(200, {
        "books": [_book_row(row) for row in rows],
        "total": total,
        "page": page,
        "per_page": BOOKS_PER_PAGE,
        "pages": max(1, ceil(total / BOOKS_PER_PAGE)),
        "summary": Book.admin_summary(),
    })


def create_book(request):
    fields, problem = _book_fields(request.json())
    if problem:
        return error(problem, 400)
    if fields[3] < 1:
        return error("Stok minimal 1 untuk buku baru", 400)

    try:
        row = Book.admin_create(*fields)
        return Response(201, {"book": _book_row(row)})
    except BookRuleError as exc:
        return error(str(exc), 409)


def update_book(request):
    book_id = _path_id(request)
    if book_id is None:
        return error("Buku tidak ditemukan", 404)
    fields, problem = _book_fields(request.json())
    if problem:
        return error(problem, 400)

    Loan.expire_stale()
    try:
        row = Book.admin_update(book_id, *fields)
        return Response(200, {"book": _book_row(row)})
    except BookNotFoundError as exc:
        return error(str(exc), 404)
    except BookRuleError as exc:
        return error(str(exc), 409)


def delete_book(request):
    book_id = _path_id(request)
    if book_id is None:
        return error("Buku tidak ditemukan", 404)

    Loan.expire_stale()
    try:
        cover = Book.admin_delete(book_id)
    except BookNotFoundError as exc:
        return error(str(exc), 404)
    except BookRuleError as exc:
        return error(str(exc), 409)

    delete_cover_file(cover)
    return Response(200, {"message": "Buku dihapus"})


def set_book_cover(request):
    book_id = _path_id(request)
    if book_id is None:
        return error("Buku tidak ditemukan", 404)

    try:
        path = save_cover(book_id, request.json().get("image"))
    except CoverError as exc:
        return error(str(exc), 400)

    try:
        row, old_cover = Book.admin_set_cover(book_id, path)
    except BookNotFoundError as exc:
        delete_cover_file(path)
        return error(str(exc), 404)

    delete_cover_file(old_cover)
    return Response(200, {"book": _book_row(row)})


def dashboard(request):
    raw = request.query.get("date", "")
    try:
        ref = date.fromisoformat(raw) if raw else _today_wib()
    except ValueError:
        return error("Format tanggal harus YYYY-MM-DD", 400)

    Loan.expire_stale()
    return Response(200, Stats.dashboard(ref))

def reports(request):
    today = _today_wib()
    period = str(request.query.get("period") or "7").strip().lower()
    raw_start = str(request.query.get("start") or "").strip()
    raw_end = str(request.query.get("end") or "").strip()

    if period == "30":
        end_date = today
        start_date = today - timedelta(days=29)
    elif period == "month":
        end_date = today
        start_date = today.replace(day=1)
    elif period == "custom" and raw_start and raw_end:
        try:
            start_date = date.fromisoformat(raw_start)
            end_date = date.fromisoformat(raw_end)
        except ValueError:
            return error("Format tanggal harus YYYY-MM-DD", 400)
        if start_date > end_date:
            return error("Tanggal mulai tidak boleh melebihi tanggal akhir", 400)
        if (end_date - start_date).days > 365:
            return error("Rentang laporan maksimal 365 hari", 400)
    else:
        end_date = today
        start_date = today - timedelta(days=6)

    Loan.expire_stale()
    return Response(200, Stats.reports(start_date, end_date, today))

def _display_status(row):
    """Status untuk tampilan: 'borrowed' yang lewat jatuh tempo jadi 'overdue'."""
    if row["status"] == "borrowed" and row["due_date"] and row["due_date"] < _today_wib():
        return "overdue"
    return row["status"]


def _loan_row(row):
    name = row["full_name"]
    return {
        "id": row["id"],
        "code": f"PN-{row['id']:04d}",
        "book_id": row["book_id"],
        "title": row["title"],
        "borrower": {
            "id": row["user_id"],
            "name": name,
            "initials": initials(name),
            "member_id": f"MB-{row['user_id']:04d}",
            "phone": row.get("phone"),
        },
        "status": row["status"],
        "display_status": _display_status(row),
        "borrowed_at": row["borrowed_at"],
        "confirmed_at": row["confirmed_at"],
        "due_date": row["due_date"],
        "returned_at": row["returned_at"],
    }


def loans(request):
    Loan.expire_stale()

    status = request.query.get("status", "all")
    period = request.query.get("period", "all")
    q = request.query.get("q", "")
    raw_page = request.query.get("page", "1")
    page = int(raw_page) if raw_page.isdigit() and int(raw_page) > 0 else 1

    rows, total = Loan.admin_search(status, q, period, page, PER_PAGE)
    return Response(200, {
        "loans": [_loan_row(row) for row in rows],
        "total": total,
        "page": page,
        "per_page": PER_PAGE,
        "pages": max(1, ceil(total / PER_PAGE)),
        "summary": Loan.admin_summary(),
    })


def create_loan(request):
    """Petugas mencatat peminjaman langsung di meja layanan (tanpa booking)."""
    body = request.json()
    member_text = str(body.get("member") or "").strip()
    book_text = str(body.get("book") or "").strip()
    raw_due = body.get("due_date")

    if not member_text or not book_text:
        return error("Peminjam dan judul buku wajib diisi", 400)

    members = User.find_for_admin(member_text)
    if not members:
        return error(
            "Anggota tidak ditemukan. Gunakan NPM, ID anggota (MB-0008), atau nama lengkap", 404
        )
    if len(members) > 1:
        return error("Ada lebih dari satu anggota yang cocok, gunakan NPM atau ID anggota", 409)

    books = Book.find_for_admin(book_text)
    if not books:
        return error("Buku tidak ditemukan. Gunakan judul persis atau kode BK-007", 404)
    if len(books) > 1:
        return error("Ada lebih dari satu buku yang cocok, gunakan kode BK-007", 409)

    due = None
    if raw_due:
        try:
            due = date.fromisoformat(str(raw_due))
        except ValueError:
            return error("Format jatuh tempo harus YYYY-MM-DD", 400)
        today = _today_wib()
        if due < today or due > today + timedelta(days=MAX_DUE_DAYS):
            return error(
                f"Jatuh tempo harus antara hari ini dan {MAX_DUE_DAYS} hari ke depan", 400
            )

    Loan.expire_stale()
    try:
        loan = Loan.create(members[0]["id"], book_id=books[0]["id"], confirmed=True, due_date=due)
        return Response(201, {"loan": loan_data(loan)})
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)


def _relative_time(dt):
    """Ubah datetime MySQL jadi teks '2 menit lalu', '1 jam lalu', atau 'Kemarin'."""
    if dt is None:
        return ""
    now = _now_wib()
    if isinstance(dt, date) and not isinstance(dt, datetime):
        diff_days = (now.date() - dt).days
        if diff_days <= 0:
            return "Hari ini"
        if diff_days == 1:
            return "Kemarin"
        return f"{diff_days} hari lalu"

    secs = max(0, int((now - dt).total_seconds()))
    if secs < 60:
        return "Baru saja"
    if secs < 3600:
        return f"{secs // 60} menit lalu"
    if secs < 86400:
        return f"{secs // 3600} jam lalu"
    days = secs // 86400
    if days == 1:
        return "Kemarin"
    return f"{days} hari lalu"


def notifications(request):
    """Gabungkan aktivitas terbaru (peminjaman, keterlambatan, anggota baru, kunjungan)."""
    from database.db import cursor
    Loan.expire_stale()
    items = []

    with cursor() as cur:
        cur.execute(
            "SELECT p.id, p.due_date, u.full_name, b.title "
            "FROM peminjaman p "
            "JOIN `user` u ON u.id = p.user_id "
            "JOIN buku b ON b.id = p.book_id "
            "WHERE p.status = 'borrowed' AND p.due_date < CURRENT_DATE() "
            "ORDER BY p.due_date ASC LIMIT 4"
        )
        for r in cur.fetchall():
            items.append({
                "key": f"overdue-{r['id']}-{r['due_date']}",
                "icon": "circle-alert",
                "tone": "red",
                "title": "Buku terlambat",
                "detail": f"Terlambat \u2022 {r['title']} ({r['full_name']}) perlu diingatkan.",
                "time": _relative_time(r["due_date"]),
                "sort_ts": str(r["due_date"]) + " 23:59:59",
                "page": "peminjaman",
            })

        cur.execute(
            "SELECT p.id, p.borrowed_at, u.full_name, b.title "
            "FROM peminjaman p "
            "JOIN `user` u ON u.id = p.user_id "
            "JOIN buku b ON b.id = p.book_id "
            "WHERE p.status = 'pending' "
            "ORDER BY p.borrowed_at DESC LIMIT 4"
        )
        for r in cur.fetchall():
            items.append({
                "key": f"pending-{r['id']}",
                "icon": "clock",
                "tone": "blue",
                "title": "Menunggu konfirmasi pinjam",
                "detail": f"Booking \u2022 {r['full_name']} ingin meminjam {r['title']}.",
                "time": _relative_time(r["borrowed_at"]),
                "sort_ts": str(r["borrowed_at"]),
                "page": "peminjaman",
            })

        cur.execute(
            "SELECT p.id, p.returned_at, u.full_name, b.title "
            "FROM peminjaman p "
            "JOIN `user` u ON u.id = p.user_id "
            "JOIN buku b ON b.id = p.book_id "
            "WHERE p.status = 'returned' AND p.returned_at IS NOT NULL "
            "ORDER BY p.returned_at DESC LIMIT 3"
        )
        for r in cur.fetchall():
            items.append({
                "key": f"returned-{r['id']}",
                "icon": "book-open",
                "tone": "blue",
                "title": "Buku dikembalikan",
                "detail": f"Pengembalian \u2022 {r['title']} oleh {r['full_name']} kembali ke rak.",
                "time": _relative_time(r["returned_at"]),
                "sort_ts": str(r["returned_at"]),
                "page": "peminjaman",
            })

        cur.execute(
            "SELECT id, full_name, created_at FROM `user` "
            "WHERE role = 'member' ORDER BY created_at DESC, id DESC LIMIT 3"
        )
        for r in cur.fetchall():
            items.append({
                "key": f"member-{r['id']}",
                "icon": "user-plus",
                "tone": "blue",
                "title": "Anggota baru terdaftar",
                "detail": f"Anggota \u2022 {r['full_name']} bergabung di perpustakaan.",
                "time": _relative_time(r["created_at"]),
                "sort_ts": str(r["created_at"]),
                "page": "anggota",
            })

        try:
            cur.execute(
                "SELECT k.id, k.created_at, k.purpose, COALESCE(u.full_name, k.visitor_name) AS name "
                "FROM kunjungan k LEFT JOIN `user` u ON u.id = k.user_id "
                "WHERE k.status = 'recorded' "
                "ORDER BY k.created_at DESC LIMIT 3"
            )
            for r in cur.fetchall():
                items.append({
                    "key": f"visit-{r['id']}",
                    "icon": "footprints",
                    "tone": "gray",
                    "title": "Aktivitas kunjungan anggota" if r.get("purpose") == "Login portal anggota" else "Pengunjung check-in",
                    "detail": f"Pengunjung \u2022 {r['name']} ({r.get('purpose') or 'Kunjungan perpustakaan'}).",
                    "time": _relative_time(r["created_at"]),
                    "sort_ts": str(r["created_at"]),
                    "page": "pengunjung",
                })
        except Exception:
            pass

    items.sort(key=lambda x: x["sort_ts"], reverse=True)
    for it in items:
        it.pop("sort_ts", None)

    return Response(200, {"notifications": items[:10]})


VISITORS_PER_PAGE = 8
ALLOWED_VISITOR_PURPOSES = {
    "meminjam buku": "Meminjam buku",
    "login portal anggota": "Login portal anggota",
    "login portal web": "Login portal anggota",
}


def _visitor_row(row):
    uid = row.get("user_id")
    member_ref = (row.get("npm") or f"MB-{int(uid):04d}") if uid else None
    return {
        "id": row["id"],
        "code": f"VS-{row['id']:04d}",
        "user_id": uid,
        "member_code": f"MB-{int(uid):04d}" if uid else None,
        "npm": row.get("npm"),
        "member_ref": member_ref,
        "name": row.get("name") or "Anggota",
        "visit_date": str(row["visit_date"])[:10] if row.get("visit_date") else None,
        "purpose": row.get("purpose"),
    }


def _parse_visitor_payload(body):
    raw_member = str(body.get("member") or "").strip()
    if not raw_member:
        return None, "Anggota wajib dipilih dari daftar"

    candidates = User.find_for_admin(raw_member)
    if not candidates:
        return None, "Anggota tidak ditemukan. Pilih anggota dari daftar"
    if len(candidates) > 1:
        return None, "Ada lebih dari satu anggota yang cocok, pilih langsung dari daftar"

    member = candidates[0]
    if member.get("role") and member["role"] != "member":
        return None, "Hanya akun anggota (member) yang dapat dicatat sebagai pengunjung"

    raw_date = str(body.get("visit_date") or "").strip()
    try:
        vdate = date.fromisoformat(raw_date) if raw_date else _today_wib()
    except ValueError:
        return None, "Format tanggal kunjungan harus YYYY-MM-DD"

    raw_purpose = str(body.get("purpose") or "").strip().lower()
    if raw_purpose not in ALLOWED_VISITOR_PURPOSES:
        return None, "Tujuan kunjungan hanya boleh 'Meminjam buku' atau 'Login portal web'"

    return {
        "user_id": member["id"],
        "visit_date": vdate,
        "purpose": ALLOWED_VISITOR_PURPOSES[raw_purpose],
    }, None


def visitors(request):
    from database.db import cursor

    q = str(request.query.get("q") or "").strip()
    raw_page = request.query.get("page", "1")
    page = int(raw_page) if raw_page.isdigit() and int(raw_page) > 0 else 1
    today = _today_wib()
    week_start = today - timedelta(days=6)

    with cursor() as cur:
        where = ["k.status = 'recorded'"]
        params = []

        if q:
            like = f"%{q}%"
            where.append(
                "(u.full_name LIKE %s OR u.npm LIKE %s "
                "OR CONCAT('VS-', LPAD(k.id, 4, '0')) LIKE %s "
                "OR CONCAT('MB-', LPAD(k.user_id, 4, '0')) LIKE %s "
                "OR k.purpose LIKE %s)"
            )
            params.extend([like, like, like, like, like])

        where_sql = " AND ".join(where)

        cur.execute(
            f"SELECT COUNT(*) AS total FROM kunjungan k LEFT JOIN `user` u ON u.id = k.user_id WHERE {where_sql}",
            tuple(params),
        )
        total = int(cur.fetchone()["total"])

        offset = (page - 1) * VISITORS_PER_PAGE
        cur.execute(
            f"SELECT k.id, k.user_id, u.npm, COALESCE(u.full_name, k.visitor_name, 'Anggota') AS name, "
            f"DATE(k.visit_date) AS visit_date, k.purpose "
            f"FROM kunjungan k "
            f"LEFT JOIN `user` u ON u.id = k.user_id "
            f"WHERE {where_sql} "
            f"ORDER BY DATE(k.visit_date) DESC, k.id DESC "
            f"LIMIT %s OFFSET %s",
            tuple(params) + (VISITORS_PER_PAGE, offset),
        )
        rows = cur.fetchall()

        cur.execute(
            "SELECT "
            "COALESCE(SUM(status = 'recorded' AND DATE(visit_date) = %s), 0) AS today_total, "
            "COALESCE(SUM(status = 'recorded' AND DATE(visit_date) BETWEEN %s AND %s), 0) AS week_total, "
            "COALESCE(SUM(status = 'recorded' AND YEAR(visit_date) = YEAR(%s) AND MONTH(visit_date) = MONTH(%s)), 0) AS month_total "
            "FROM kunjungan",
            (today, week_start, today, today, today),
        )
        srow = cur.fetchone()

    return Response(200, {
        "visitors": [_visitor_row(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": VISITORS_PER_PAGE,
        "pages": max(1, ceil(total / VISITORS_PER_PAGE)),
        "summary": {
            "today": int(srow["today_total"]),
            "week": int(srow["week_total"]),
            "month": int(srow["month_total"]),
            "today_date": str(today),
            "week_start": str(week_start),
        },
    })


def create_visitor(request):
    from database.db import cursor

    data, problem = _parse_visitor_payload(request.json())
    if problem:
        return error(problem, 400)

    with cursor() as cur:
        cur.execute(
            "INSERT INTO kunjungan (user_id, visit_date, purpose, status) VALUES (%s, %s, %s, 'recorded')",
            (data["user_id"], data["visit_date"], data["purpose"]),
        )
        new_id = cur.lastrowid

    return Response(201, {"id": new_id, "code": f"VS-{new_id:04d}", "message": "Pengunjung ditambahkan"})


def update_visitor(request):
    from database.db import cursor

    visitor_id = _path_id(request)
    if visitor_id is None:
        return error("Data pengunjung tidak ditemukan", 404)

    data, problem = _parse_visitor_payload(request.json())
    if problem:
        return error(problem, 400)

    with cursor() as cur:
        cur.execute("SELECT id FROM kunjungan WHERE id = %s", (visitor_id,))
        if not cur.fetchone():
            return error("Data pengunjung tidak ditemukan", 404)

        cur.execute(
            "UPDATE kunjungan SET user_id = %s, visit_date = %s, purpose = %s, status = 'recorded' WHERE id = %s",
            (data["user_id"], data["visit_date"], data["purpose"], visitor_id),
        )

    return Response(200, {"id": visitor_id, "code": f"VS-{visitor_id:04d}", "message": "Data pengunjung diperbarui"})
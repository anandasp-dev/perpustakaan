from core.response import Response, error
from datetime import date
from models.loan import Loan, LoanNotFoundError, LoanRuleError


def loan_data(loan):
    return {
        "id": loan["id"],
        "book_id": loan["book_id"],
        "title": loan["title"],
        "author": loan["author"],
        "category": loan["category"],
        "cover": loan["cover"],
        "borrowed_at": loan["borrowed_at"],
        "due_date": loan["due_date"],
        "confirmed_at": loan.get("confirmed_at"),
        "returned_at": loan["returned_at"],
        "status": loan["status"],
        "renew_count": loan.get("renew_count", 0),
        "confirm_deadline": loan.get("confirm_deadline"),
        "confirm_seconds_left": loan.get("confirm_seconds_left"),
    }


def _loan_id(request):
    """Ambil angka {id} dari alamat. Bukan angka -> None."""
    raw = request.params.get("id", "")
    return int(raw) if raw.isdigit() else None


def list_loans(request):
    Loan.expire_stale()
    user_id = request.user["id"]
    loans = Loan.find_active_for_user(user_id)
    history = Loan.find_history_for_user(user_id)
    return Response(200, {
        "loans": [loan_data(loan) for loan in loans],
        "history": [loan_data(loan) for loan in history],
        "borrowed_this_month": Loan.count_this_month(user_id),
    })


def borrow(request):
    if request.user.get("role") != "member":
        return error("Hanya akun anggota (member) yang dapat meminjam buku", 403)

    body = request.json()
    raw_book_id = body.get("book_id")
    book_id = int(raw_book_id) if isinstance(raw_book_id, int) or (
        isinstance(raw_book_id, str) and raw_book_id.isdigit()
    ) else None
    title = body.get("title")

    if book_id is None and not isinstance(title, str):
        return error("Buku tidak valid", 400)

    Loan.expire_stale()
    try:
        loan = Loan.create(request.user["id"], book_id=book_id, title=title)
        return Response(201, {"loan": loan_data(loan)})
    except ValueError as exc:
        return error(str(exc), 400)
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)


def renew(request):
    loan_id = _loan_id(request)
    if loan_id is None:
        return error("Pinjaman tidak ditemukan", 404)

    try:
        loan = Loan.renew(request.user["id"], loan_id)
        return Response(200, {"loan": loan_data(loan)})
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)


def cancel(request):
    loan_id = _loan_id(request)
    if loan_id is None:
        return error("Pinjaman tidak ditemukan", 404)

    Loan.expire_stale()
    try:
        loan = Loan.cancel(request.user["id"], loan_id)
        return Response(200, {"loan": loan_data(loan)})
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)


def confirm(request):
    """Khusus admin."""
    loan_id = _loan_id(request)
    if loan_id is None:
        return error("Pinjaman tidak ditemukan", 404)

    Loan.expire_stale()
    try:
        loan = Loan.confirm(loan_id)
        return Response(200, {"loan": loan_data(loan)})
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)


def give_back(request):
    """Khusus admin: buku diterima kembali."""
    loan_id = _loan_id(request)
    if loan_id is None:
        return error("Pinjaman tidak ditemukan", 404)

    Loan.expire_stale()
    try:
        loan = Loan.mark_returned(loan_id)
        return Response(200, {"loan": loan_data(loan)})
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)


def set_due_date(request):
    """Khusus admin: ubah jatuh tempo pinjaman yang sedang dipinjam."""
    loan_id = _loan_id(request)
    if loan_id is None:
        return error("Pinjaman tidak ditemukan", 404)

    raw = str(request.json().get("due_date") or "").strip()
    try:
        new_due = date.fromisoformat(raw)
    except ValueError:
        return error("Format jatuh tempo harus YYYY-MM-DD", 400)

    try:
        loan = Loan.set_due_date(loan_id, new_due)
        return Response(200, {"loan": loan_data(loan)})
    except LoanNotFoundError as exc:
        return error(str(exc), 404)
    except LoanRuleError as exc:
        return error(str(exc), 409)
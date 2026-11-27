from core.response import Response

from models.loan import Loan
from models.notification import Notification


def list_notifications(request):
    Loan.expire_stale()   # supaya booking yang hangus langsung tercatat
    items, unread = Notification.for_user(request.user["id"])
    return Response(200, {"notifications": items, "unread": unread})


def mark_read(request):
    Notification.mark_seen(request.user["id"])
    return Response(200, {"message": "Semua notifikasi ditandai sudah dibaca"})
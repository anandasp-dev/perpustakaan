/* =========================================================
   api.js — "kurir" antara browser dan server Python (REST API)
   Dipasang SEBELUM app.js di tiap halaman member.
   ========================================================= */
(function () {
  "use strict";

  // Gambar bawaan kalau kolom cover di database masih kosong
  const DEFAULT_COVER = "/assets/Book%20cover.png";
  // Nama bulan dan tema sampul mengikuti desain temanmu
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const COVER_THEMES = ["theme-ochre", "theme-forest"];

  // Ubah isi kolom cover (mis. "Book cover.png") jadi alamat yang bisa dibuka browser
  function coverUrl(cover) {
    if (!cover) return DEFAULT_COVER;
    if (cover.indexOf("/") !== -1) {
      return encodeURI(cover.charAt(0) === "/" ? cover : "/" + cover);
    }
    return "/assets/" + encodeURIComponent(cover);
  }

  // Panggil server. Kalau gagal, lempar error yang membawa kode status (401, 404, ...)
  async function request(url, options) {
    const response = await fetch(url, options);
    const body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      const error = new Error(body.message || "Permintaan gagal");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  // ---------------- BUKU ----------------
  function toCatalogBook(row) {
    return {
      id: String(row.id),            // app.js memakai id berupa teks (untuk ?id=... di alamat)
      databaseId: row.id,            // id asli di database, dikirim saat meminjam
      title: row.title,
      author: row.author,
      category: row.category || "Lainnya",
      copies: row.stock,
      cover: coverUrl(row.cover),
      synopsis: "Deskripsi buku belum tersedia."
    };
  }

  async function getBooks() {
    const body = await request("/api/books");
    return body.books.map(toCatalogBook);
  }

  // ---------------- TANGGAL ----------------
  // "2026-12-03" atau "2026-12-03 20:00:51" -> objek tanggal (jam diabaikan)
  function parseDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  // objek tanggal -> "03 Dec 2026"
  function formatDate(date) {
    if (!date) return "-";
    return String(date.getDate()).padStart(2, "0") + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
  }

  // "2026-11-22 16:02:29" -> "22 Nov 2026, 16:02"
  function formatDateTime(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || ""));
    if (!m) return "-";
    return m[3] + " " + MONTHS[Number(m[2]) - 1] + " " + m[1] + ", " + m[4] + ":" + m[5];
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  // Hitung sisa hari dari hari ini sampai batas pengembalian
  function daysLeftText(due) {
    if (!due) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);   // 86400000 ms = 1 hari
    if (diff > 0) return diff + " hari tersisa";
    if (diff === 0) return "Jatuh tempo hari ini";
    return "Terlambat " + Math.abs(diff) + " hari";
  }

  // ---------------- PINJAMAN ----------------
  // Terjemahkan 1 baris pinjaman dari server ke bentuk kartu milik app.js
  function toLoan(row) {
    const due = parseDate(row.due_date);
    const renewed = (row.renew_count || 0) >= 1;
    const pending = row.status === "pending";
    const extended = due && !renewed ? addDays(due, 7) : due;
    return {
      id: String(row.book_id),
      loanId: row.id,
      bookId: row.book_id,
      status: row.status,
      pending: pending,
      loanNumber: "#" + String(row.id).padStart(4, "0"),
      confirmDeadline: formatDateTime(row.confirm_deadline),
      // kapan hitung mundur habis, menurut jam browser (server hanya mengirim "sisa detik")
      expiresAt: Date.now() + (Number(row.confirm_seconds_left) || 0) * 1000,
      title: row.title,
      subtitle: row.title,
      author: row.author,
      category: row.category || "Lainnya",
      borrowDate: formatDate(parseDate(row.confirmed_at || row.borrowed_at)),
      dueDate: formatDate(due),
      extendedDueDate: formatDate(extended),
      daysLeftText: daysLeftText(due),
      renewed: renewed,
      coverTheme: COVER_THEMES[row.book_id % COVER_THEMES.length],
      coverImage: row.cover ? coverUrl(row.cover) : ""
    };
  }

    // Pinjaman yang sudah dikembalikan -> kartu riwayat
  function toHistory(row) {
    const due = parseDate(row.due_date);
    const back = parseDate(row.returned_at);
    let catatan = "Dikembalikan tepat waktu";
    if (due && back && back > due) {
      catatan = "Terlambat " + Math.round((back - due) / 86400000) + " hari";
    }
    return {
      id: String(row.id),
      title: row.title,
      author: row.author,
      category: row.category || "Lainnya",
      borrowDate: formatDate(parseDate(row.confirmed_at || row.borrowed_at)),
      returnedDate: formatDate(back),
      note: catatan,
      coverTheme: COVER_THEMES[row.book_id % COVER_THEMES.length],
      coverImage: row.cover ? coverUrl(row.cover) : ""
    };
  }

  // Sekarang mengembalikan dua hal: daftar pinjaman dan jumlah pinjaman bulan ini
    async function getLoans() {
    const body = await request("/api/loans");
    return {
      loans: body.loans
        .filter(function (row) { return row.status === "borrowed" || row.status === "pending"; })
        .map(toLoan),
      history: (body.history || []).map(toHistory),
      monthlyBorrowed: body.borrowed_this_month || 0
    };
  }
  async function renewLoan(loanId) {
    const body = await request("/api/loans/" + loanId + "/renew", { method: "POST" });
    return body.loan;
  }

  async function cancelLoan(loanId) {
    const body = await request("/api/loans/" + loanId + "/cancel", { method: "POST" });
    return body.loan;
  }

  async function getProfile() {
    const body = await request("/api/profile");
    return body.profile;
  }

  async function updateProfile(data) {
    const body = await request("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return body.profile;
  }

    // "2026-11-23 10:15:00" -> "2 menit lalu"
  function waktuRelatif(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(teks || ""));
    if (!m) return "";
    const kapan = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    const menit = Math.round((Date.now() - kapan.getTime()) / 60000);
    if (menit < 1) return "Baru saja";
    if (menit < 60) return menit + " menit lalu";
    const jam = Math.floor(menit / 60);
    if (jam < 24) return jam + " jam lalu";
    const hari = Math.floor(jam / 24);
    return hari === 1 ? "Kemarin" : hari + " hari lalu";
  }

  // diubah ke bentuk yang dipahami dropdown lonceng milik app.js
  async function getNotifications() {
    const body = await request("/api/notifications");
    return body.notifications.map(function (n) {
      return {
        id: n.id,
        type: n.level,
        icon: n.icon,
        title: n.title,
        desc: n.message,
        time: waktuRelatif(n.time),
        unread: n.unread
      };
    });
  }

  async function markNotificationsRead() {
    await request("/api/notifications/read", { method: "POST" });
  }

  window.LibraryApi = { 
    request: request, 
    getBooks: getBooks, 
    getLoans: getLoans, 
    renewLoan: renewLoan, 
    cancelLoan: cancelLoan,
    getProfile: getProfile,
    updateProfile: updateProfile,
    getNotifications: getNotifications,
    markNotificationsRead: markNotificationsRead
  };
})();
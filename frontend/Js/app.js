/* =========================================================
   KEYTO LIBRARY — UNIFIED APPLICATION SCRIPT (MULTI-PAGE)
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "unindra_library_state_v1";
  const MEMBER_READ_NOTIFS_PREFIX = "keyto_member_read_notifs_";

  const DEFAULT_STATE = {
    isLoggedIn: false,
    role: "member",
    user: {
      fullName: "",
      npm: "-",
      memberId: "-",
      prodi: "Belum diisi",
      email: "-",
      phone: "Belum ditambahkan",
      status: "Anggota",
      visits: 0,
      visitsThisMonth: 0,
      monthlyBorrowed: 0
    },
    eventSaved: false,
    profileUpdatedDemo: false,
    catalogBooks: [],
    activeLoans: [],
    loanHistory: [],
    notifications: []
  };

  let state = loadState();
  let pendingRenewLoanId = null;
  let currentHomeCategory = "All";
  let currentBooksCategory = "All";
  let currentBooksQuery = "";

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return JSON.parse(JSON.stringify(DEFAULT_STATE));
      const parsed = JSON.parse(saved);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), {
        eventSaved: !!parsed.eventSaved,
        profileUpdatedDemo: !!parsed.profileUpdatedDemo
      });
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          eventSaved: state.eventSaved,
          profileUpdatedDemo: state.profileUpdatedDemo
        })
      );
    } catch (e) {
      console.warn("Gagal menyimpan ke localStorage:", e);
    }
  }

  // =========================================================
  // HELPERS & UI UTILITIES
  // =========================================================
  function esc(teks) {
    return String(teks ?? "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildPageUrl(pageName, queryString) {
    const useHtml = window.location.pathname.endsWith(".html");
    let base;
    if (pageName === "index") {
      base = useHtml ? "../index.html" : "/index";
    } else {
      base = useHtml ? `${pageName}.html` : `/Pages/${pageName}`;
    }
    return queryString ? `${base}?${queryString}` : base;
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function padTwo(num) {
    return String(num).padStart(2, "0");
  }

  const BULAN_PENUH = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
                      "Agustus", "September", "Oktober", "November", "Desember"];
  const HARI_EN = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const BULAN_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY",
                    "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

  function formatHeroDate(d) {
    return HARI_EN[d.getDay()] + ", " + padTwo(d.getDate()) + " " + BULAN_EN[d.getMonth()] + " " + d.getFullYear();
  }

  function findStatCard(label) {
    return Array.from(document.querySelectorAll(".stat-card")).find(function (card) {
      const el = card.querySelector(".stat-label");
      return el && el.textContent.trim() === label;
    });
  }

  function renderMonthlyStatCards() {
    const bulan = BULAN_PENUH[new Date().getMonth()];

    const pinjam = findStatCard("Dipinjam bulan ini");
    if (pinjam) {
      const note = pinjam.querySelector(".stat-footnote");
      if (note) note.textContent = "Peminjaman " + bulan;
    }

    const kunjungan = findStatCard("Kunjungan perpustakaan");
    if (kunjungan) {
      const nilai = kunjungan.querySelector(".stat-value");
      const note = kunjungan.querySelector(".stat-footnote");
      if (nilai) nilai.textContent = padTwo(state.user.visitsThisMonth || 0);
      if (note) note.textContent = "Kunjungan " + bulan;
    }
  }

  window.showToast = function (message) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.25s ease";
      setTimeout(() => toast.remove(), 260);
    }, 3000);
  };

  window.openModal = function (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove("hidden");
  };

  window.closeModal = function (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add("hidden");
  };

  document.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) {
      e.target.classList.add("hidden");
    }
    const dropdown = document.getElementById("notif-dropdown");
    const bellBtn = document.getElementById("notif-bell-btn");
    if (
      dropdown &&
      !dropdown.classList.contains("hidden") &&
      !dropdown.contains(e.target) &&
      bellBtn &&
      !bellBtn.contains(e.target)
    ) {
      dropdown.classList.add("hidden");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(function (el) {
      el.classList.add("hidden");
    });
    const dropdown = document.getElementById("notif-dropdown");
    if (dropdown) dropdown.classList.add("hidden");
  });

  // =========================================================
  // SHARED NAVBAR, NOTIFICATIONS & RENEWAL MODALS
  // =========================================================
  function getReadNotifSet() {
    try {
      const key = MEMBER_READ_NOTIFS_PREFIX + (state.user.memberId || "guest");
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveReadNotifSet(set) {
    try {
      const key = MEMBER_READ_NOTIFS_PREFIX + (state.user.memberId || "guest");
      const arr = Array.from(set).slice(-100);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  function applyLocalReadStatus(items) {
    const readSet = getReadNotifSet();
    return (items || []).map(function (item) {
      return Object.assign({}, item, {
        unread: Boolean(item.unread) && !readSet.has(String(item.id))
      });
    });
  }

  function initSharedShell(pageName) {
    if (!state.isLoggedIn) {
      state.isLoggedIn = true;
      state.role = "member";
    }

    document.querySelectorAll(".nav-item[data-nav]").forEach((el) => {
      if (el.getAttribute("data-nav") === pageName) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    const avatarChip = document.getElementById("navbar-avatar");
    if (avatarChip) {
      avatarChip.textContent = getInitials(state.user.fullName);
    }

    const dropTitle = document.querySelector("#notif-dropdown .notif-drop-title");
    const markReadBtn = document.querySelector("#notif-dropdown .btn-mark-read");
    const dropFootBtn = document.querySelector("#notif-dropdown .notif-drop-foot");
    if (dropTitle) dropTitle.textContent = "Notifikasi";
    if (markReadBtn) markReadBtn.textContent = "Tandai Semua Dibaca";
    if (dropFootBtn) dropFootBtn.textContent = "Lihat Semua Notifikasi →";

    renderNotificationDropdown();
    startCountdown();
    startNotificationPolling();
  }

  window.toggleNotifDropdown = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("notif-dropdown");
    if (dropdown) dropdown.classList.toggle("hidden");
  };

  window.markAllNotificationsRead = async function () {
    try {
      await window.LibraryApi.markNotificationsRead();
      const readSet = getReadNotifSet();
      state.notifications.forEach((n) => {
        n.unread = false;
        if (n.id !== undefined && n.id !== null) readSet.add(String(n.id));
      });
      saveReadNotifSet(readSet);
      renderNotificationDropdown();
      showToast("Semua notifikasi ditandai sudah dibaca.");
    } catch (error) {
      showToast(error.message);
    }
  };

  window.openMemberNotificationItem = function (notifId) {
    const idStr = String(notifId || "");
    const readSet = getReadNotifSet();
    let changed = false;

    state.notifications.forEach(function (n) {
      if (String(n.id) === idStr && n.unread) {
        n.unread = false;
        changed = true;
      }
    });

    if (idStr && !readSet.has(idStr)) {
      readSet.add(idStr);
      saveReadNotifSet(readSet);
    }

    if (changed) {
      renderNotificationDropdown();
      const remainingUnread = state.notifications.filter(function (n) { return n.unread; }).length;
      if (remainingUnread === 0) {
        window.LibraryApi.markNotificationsRead().catch(function () {});
      }
    }

    openMemberNotificationsModal();
  };

  function getNotifSvg(icon) {
    if (icon === "clock") {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
    }
    if (icon === "user") {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`;
    }
    if (icon === "steps") {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"></path><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"></path></svg>`;
    }
    if (icon === "alert") {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
  }

  function renderNotificationDropdown() {
    const listEl = document.getElementById("notif-drop-list");
    const countEl = document.getElementById("notif-unread-count");
    const dotEl = document.getElementById("notif-dot");
    if (!listEl) return;

    const unreadCount = state.notifications.filter((n) => n.unread).length;
    if (countEl) countEl.textContent = `${unreadCount} belum dibaca`;
    if (dotEl) dotEl.classList.toggle("hidden", unreadCount === 0);

    if (state.notifications.length === 0) {
      listEl.innerHTML =
        '<div class="notif-drop-item"><div class="notif-item-body">' +
        '<div class="notif-item-desc">Belum ada notifikasi.</div></div></div>';
      return;
    }

    listEl.innerHTML = state.notifications
      .map(
        (item) => `
      <div class="notif-drop-item${item.unread ? " unread" : ""}" onclick="openMemberNotificationItem('${esc(item.id)}')">
        <div class="notif-item-icon ${esc(item.type)}">${getNotifSvg(item.icon)}</div>
        <div class="notif-item-body">
          <div class="notif-item-title">${esc(item.title)}</div>
          <div class="notif-item-desc">${esc(item.desc)}</div>
        </div>
        <div class="notif-item-meta">
          <span class="notif-item-time">${esc(item.time)}</span>
          ${item.unread ? '<span class="notif-unread-dot"></span>' : ""}
        </div>
      </div>
    `
      )
      .join("");
  }

  window.openMemberNotificationsModal = function () {
    const dropdown = document.getElementById("notif-dropdown");
    if (dropdown) dropdown.classList.add("hidden");

    const container = document.getElementById("modal-notif-loans-list");
    if (container) {
      if (state.activeLoans.length === 0) {
        container.innerHTML =
          '<div class="modal-notif-item"><div class="modal-notif-sub">Belum ada pinjaman aktif saat ini.</div></div>';
      } else {
        container.innerHTML = state.activeLoans
          .map((loan) => {
            if (loan.pending) {
              return `
                <div class="modal-notif-item">
                  <div class="modal-notif-title">${esc(loan.title)}</div>
                  <div class="modal-notif-sub">Menunggu konfirmasi · batas ${esc(loan.confirmDeadline)}</div>
                </div>
              `;
            }

            const activeDue = loan.renewed ? loan.extendedDueDate : loan.dueDate;
            const statusNote = loan.renewed
              ? "Diperpanjang 1 kali"
              : loan.daysLeftText.replace("tersisa", "lagi");
            return `
              <div class="modal-notif-item">
                <div class="modal-notif-title">${esc(loan.title)}</div>
                <div class="modal-notif-sub">Jatuh tempo ${esc(activeDue)} · ${esc(statusNote)}</div>
              </div>
            `;
          })
          .join("");
      }
    }
    openModal("modal-member-notifications");
  };

  // =========================================================
  // RENDER CARD HELPERS (ACTIVE LOANS & CATALOG BOOKS)
  // =========================================================
  function createLoanCardHTML(loan) {
    const pending = !!loan.pending;
    const activeDue = loan.renewed ? loan.extendedDueDate : loan.dueDate;
    const remainingText = loan.renewed ? "Diperpanjang 1 kali" : loan.daysLeftText;
    const coverMarkup = loan.coverImage
      ? `<img src="${esc(loan.coverImage)}" alt="${esc(loan.title)}" class="loan-cover-img" />`
      : `<div class="loan-cover-art ${esc(loan.coverTheme || "theme-ochre")}">
           <div class="loan-cover-art-title">${esc(loan.title)}</div>
           <div class="loan-cover-art-author">${esc(loan.author)}</div>
         </div>`;

    const badgeClass = pending ? "pending" : loan.renewed ? "renewed" : "";
    const badgeText = pending ? "Tunggu konfirmasi" : loan.renewed ? "Diperpanjang" : "Dipinjam";

    const datesMarkup = pending
      ? `<div>
           <div class="loan-date-label">No. pinjaman</div>
           <div class="loan-date-value">${esc(loan.loanNumber)}</div>
         </div>
         <div>
           <div class="loan-date-label">Konfirmasi paling lambat</div>
           <div class="loan-date-value">${esc(loan.confirmDeadline)}</div>
         </div>`
      : `<div>
           <div class="loan-date-label">Tanggal pinjam</div>
           <div class="loan-date-value">${esc(loan.borrowDate)}</div>
         </div>
         <div>
           <div class="loan-date-label">Batas pengembalian</div>
           <div class="loan-date-value">${esc(activeDue)}</div>
         </div>`;

    const bottomMarkup = pending
      ? `<span class="loan-remaining">Sisa waktu
           <strong class="loan-countdown" data-expires="${Number(loan.expiresAt) || 0}">${formatCountdown(loan.expiresAt - Date.now())}</strong>
         </span>
         <button type="button" class="btn-renew btn-cancel" onclick="openCancelModal('${esc(loan.id)}')">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="18" y1="6" x2="6" y2="18"></line>
             <line x1="6" y1="6" x2="18" y2="18"></line>
           </svg>
           <span>Batalkan peminjaman</span>
         </button>`
      : `<span class="loan-remaining">${esc(remainingText)}</span>
         <button
           type="button"
           class="btn-renew"
           ${loan.renewed ? "disabled" : ""}
           onclick="openRenewModal('${esc(loan.id)}')"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <polyline points="23 4 23 10 17 10"></polyline>
             <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
           </svg>
           <span>${loan.renewed ? "Sudah diperpanjang" : "Perpanjang pinjaman"}</span>
         </button>`;

    return `
      <article class="loan-card">
        <div class="loan-card-top">
          ${coverMarkup}
          <div class="loan-info">
            <span class="badge-status ${badgeClass}">${badgeText}</span>
            <h3 class="loan-title">${esc(loan.title)}</h3>
            <div class="loan-subtitle">${esc(loan.subtitle || loan.title)}</div>
            <div class="loan-author">${esc(loan.author)}</div>
            <div class="loan-borrower">Peminjam: ${esc(state.user.fullName)}</div>
          </div>
        </div>
        <div class="loan-dates-row">
          ${datesMarkup}
        </div>
        <div class="loan-card-bottom">
          ${bottomMarkup}
        </div>
      </article>
    `;
  }

  function createHistoryCardHTML(item) {
    const coverMarkup = item.coverImage
      ? `<img src="${esc(item.coverImage)}" alt="${esc(item.title)}" class="loan-cover-img" />`
      : `<div class="loan-cover-art ${esc(item.coverTheme || "theme-ochre")}">
           <div class="loan-cover-art-title">${esc(item.title)}</div>
           <div class="loan-cover-art-author">${esc(item.author)}</div>
         </div>`;

    return `
      <article class="loan-card">
        <div class="loan-card-top">
          ${coverMarkup}
          <div class="loan-info">
            <span class="badge-status renewed">Dikembalikan</span>
            <h3 class="loan-title">${esc(item.title)}</h3>
            <div class="loan-subtitle">${esc(item.title)}</div>
            <div class="loan-author">${esc(item.author)}</div>
          </div>
        </div>
        <div class="loan-dates-row">
          <div>
            <div class="loan-date-label">Tanggal pinjam</div>
            <div class="loan-date-value">${esc(item.borrowDate)}</div>
          </div>
          <div>
            <div class="loan-date-label">Tanggal kembali</div>
            <div class="loan-date-value">${esc(item.returnedDate)}</div>
          </div>
        </div>
        <div class="loan-card-bottom">
          <span class="loan-remaining">${esc(item.note)}</span>
        </div>
      </article>
    `;
  }

  function createBookCardHTML(book, includeActionButton) {
    const detailUrl = esc(buildPageUrl("buku", `id=${encodeURIComponent(book.id)}`));
    return `
      <div class="book-item-wrapper">
        <article class="book-card">
          <img src="${esc(book.cover)}" alt="${esc(book.title)}" class="book-thumb" />
          <div class="book-card-body">
            <h3 class="book-card-title">${esc(book.title)}</h3>
            <div class="book-card-author">${esc(book.author)}</div>
            <div class="book-card-meta">${Number(book.copies || 0)} copies available · ${esc(book.category)}</div>
            <a href="${detailUrl}" class="book-card-link">Lihat buku →</a>
          </div>
        </article>
        ${
          includeActionButton
            ? `<a href="${detailUrl}" class="btn btn-primary btn-block">Lihat detail &amp; pinjam</a>`
            : ""
        }
      </div>
    `;
  }

  // =========================================================
  // RENEWAL FLOW (MODAL KONFIRMASI + MODAL SUKSES)
  // =========================================================
  window.openRenewModal = function (loanId) {
    const loan = state.activeLoans.find((l) => l.id === loanId);
    if (!loan || loan.renewed) return;

    pendingRenewLoanId = loanId;
    const titleEl = document.getElementById("renew-modal-book-title");
    const descEl = document.getElementById("renew-modal-new-date");
    if (titleEl) titleEl.textContent = loan.title;
    if (descEl) {
      descEl.textContent = `Perpanjangan 7 hari. Tanggal pengembalian baru: ${loan.extendedDueDate}.`;
    }
    openModal("modal-renew-confirm");
  };

  window.confirmRenewLoan = async function () {
    if (!pendingRenewLoanId) return;
    const loan = state.activeLoans.find((l) => l.id === pendingRenewLoanId);
    pendingRenewLoanId = null;
    if (!loan) return;

    try {
      await window.LibraryApi.renewLoan(loan.loanId);
      await syncCatalogAndLoansFromApi();
      closeModal("modal-renew-confirm");
      openModal("modal-renew-complete");
      refreshCurrentPage();
    } catch (error) {
      closeModal("modal-renew-confirm");
      showToast(error.message);
    }
  };

  // =========================================================
  // HITUNG MUNDUR & PEMBATALAN BOOKING
  // =========================================================
  let countdownTimer = null;
  let countdownRefreshing = false;
  let pendingCancelLoanId = null;
  let notifTimer = null;

  function startNotificationPolling() {
    if (notifTimer) return;
    notifTimer = setInterval(async function () {
      try {
        const fresh = await window.LibraryApi.getNotifications();
        state.notifications = applyLocalReadStatus(fresh);
        renderNotificationDropdown();
      } catch (error) {
        if (error && error.status === 401) {
          window.location.href = buildPageUrl("index");
        }
      }
    }, 60000);
  }

  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return padTwo(h) + ":" + padTwo(m) + ":" + padTwo(s);
  }

  function startCountdown() {
    if (countdownTimer) return;
    countdownTimer = setInterval(function () {
      const spans = document.querySelectorAll(".loan-countdown");
      let expired = false;
      spans.forEach(function (el) {
        const left = Number(el.getAttribute("data-expires")) - Date.now();
        el.textContent = formatCountdown(left);
        if (left <= 0) expired = true;
      });
      if (expired && !countdownRefreshing) {
        countdownRefreshing = true;
        syncCatalogAndLoansFromApi()
          .then(refreshCurrentPage)
          .finally(function () { countdownRefreshing = false; });
      }
    }, 1000);
  }

  function ensureCancelModal() {
    if (document.getElementById("modal-cancel-confirm")) return;
    const wrap = document.createElement("div");
    wrap.id = "modal-cancel-confirm";
    wrap.className = "modal-backdrop hidden";
    wrap.innerHTML = `
      <div class="modal-card">
        <h3 class="modal-title">Batalkan peminjaman?</h3>
        <div id="cancel-modal-book-title" style="font-weight: 700; font-size: 15px; margin-bottom: 8px;"></div>
        <p class="modal-desc">Booking dibatalkan dan stok buku langsung dikembalikan. Anda bisa meminjam lagi kapan saja.</p>
        <div class="modal-actions-stack">
          <button type="button" class="btn btn-primary btn-block" onclick="confirmCancelLoan()">Ya, batalkan</button>
          <button type="button" class="btn btn-outline btn-block" onclick="closeModal('modal-cancel-confirm')">Tidak jadi</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  window.openCancelModal = function (loanId) {
    const loan = state.activeLoans.find((l) => l.id === loanId);
    if (!loan || !loan.pending) return;
    ensureCancelModal();
    pendingCancelLoanId = loanId;
    document.getElementById("cancel-modal-book-title").textContent = loan.title;
    openModal("modal-cancel-confirm");
  };

  window.confirmCancelLoan = async function () {
    const loan = state.activeLoans.find((l) => l.id === pendingCancelLoanId);
    pendingCancelLoanId = null;
    if (!loan) return;

    try {
      await window.LibraryApi.cancelLoan(loan.loanId);
      closeModal("modal-cancel-confirm");
      showToast(`Peminjaman "${loan.title}" dibatalkan. Stok buku sudah dikembalikan.`);
    } catch (error) {
      closeModal("modal-cancel-confirm");
      showToast(error.message);
    }
    await syncCatalogAndLoansFromApi();
    refreshCurrentPage();
  };

  // =========================================================
  // PAGE: HOME (dashboard.html)
  // =========================================================
  function initHomePage() {
    const firstName = (state.user.fullName || "Anggota").split(" ")[0];
    const greetingEl = document.getElementById("home-greeting");
    const metaEl = document.getElementById("home-member-meta");
    const activeStatEl = document.getElementById("stat-active-loans");
    const monthlyStatEl = document.getElementById("stat-monthly-loans");
    const loansContainer = document.getElementById("home-loans-grid");
    const eventBtn = document.getElementById("btn-save-seat");
    const heroDate = document.querySelector(".hero-date");

    if (greetingEl) greetingEl.textContent = `A new chapter, ${firstName}.`;
    if (metaEl) {
      metaEl.textContent = `${state.user.fullName || "Anggota"} · NPM ${state.user.npm} · ${state.user.memberId} · Active member`;
    }
    if (activeStatEl) activeStatEl.textContent = padTwo(state.activeLoans.length);
    if (monthlyStatEl) monthlyStatEl.textContent = padTwo(state.user.monthlyBorrowed);

    if (loansContainer) {
      loansContainer.innerHTML =
        state.activeLoans.length > 0
          ? state.activeLoans.map(createLoanCardHTML).join("")
          : `<p class="section-meta">Belum ada pinjaman aktif saat ini.</p>`;
    }

    if (eventBtn) {
      eventBtn.textContent = state.eventSaved ? "Seat reserved ✓" : "Save your seat →";
    }

    if (heroDate) heroDate.textContent = formatHeroDate(new Date());
    renderMonthlyStatCards();

    renderHomeCatalog();
  }

  function renderHomeCatalog() {
    const grid = document.getElementById("home-books-grid");
    if (!grid) return;

    const filtered = state.catalogBooks.filter((book) => {
      if (currentHomeCategory === "All") return true;
      return book.category.toLowerCase() === currentHomeCategory.toLowerCase();
    });

    if (filtered.length === 0) {
      grid.innerHTML =
        currentHomeCategory === "All"
          ? `<p class="section-meta">Belum ada koleksi buku yang ditampilkan.</p>`
          : `<p class="section-meta">Buku kategori ${esc(currentHomeCategory)} sedang dipinjam atau belum tersedia di rak rekomendasi.</p>`;
      return;
    }

    grid.innerHTML = filtered.map((b) => createBookCardHTML(b, false)).join("");
  }

  window.filterHomeBooks = function (category, btn) {
    currentHomeCategory = category;
    document.querySelectorAll("#home-pills .pill-btn").forEach((p) => p.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderHomeCatalog();
  };

  window.submitHomeSearch = function (e) {
    e.preventDefault();
    const input = document.getElementById("home-search-input");
    const query = input ? input.value.trim() : "";
    window.location.href = buildPageUrl("buku", query ? `q=${encodeURIComponent(query)}` : "");
  };

  window.toggleEventSeat = function () {
    state.eventSaved = !state.eventSaved;
    saveState();
    const btn = document.getElementById("btn-save-seat");
    if (btn) btn.textContent = state.eventSaved ? "Seat reserved ✓" : "Save your seat →";
    showToast(
      state.eventSaved
        ? "Kursi Anda untuk Between the Pages berhasil dipesan."
        : "Reservasi kursi dibatalkan."
    );
  };

  // =========================================================
  // PAGE: BUKU & DETAIL BUKU (buku.html)
  // =========================================================
  function initBooksPage() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("id");
    const searchQuery = params.get("q");

    const listView = document.getElementById("books-list-view");
    const detailView = document.getElementById("book-detail-view");

    if (bookId) {
      if (listView) listView.classList.add("hidden");
      if (detailView) detailView.classList.remove("hidden");
      renderBookDetail(bookId);
      return;
    }

    if (listView) listView.classList.remove("hidden");
    if (detailView) detailView.classList.add("hidden");

    if (searchQuery) {
      currentBooksQuery = searchQuery;
      const searchInput = document.getElementById("books-search-input");
      if (searchInput) searchInput.value = searchQuery;
    }

    renderBooksCatalogAndLoans();
  }

  function renderBooksCatalogAndLoans() {
    const catalogSection = document.getElementById("books-catalog-section");
    const catalogHeading = document.getElementById("books-catalog-heading");
    const catalogGrid = document.getElementById("books-catalog-grid");

    const loansSection = document.getElementById("books-loans-section");
    const loansCategoryBanner = document.getElementById("books-category-loan-banner");
    const loansGrid = document.getElementById("books-loans-grid");

    const q = currentBooksQuery.trim().toLowerCase();

    if (q) {
      if (catalogSection) catalogSection.classList.remove("hidden");
      if (loansSection) loansSection.classList.add("hidden");
      if (loansCategoryBanner) loansCategoryBanner.classList.add("hidden");
      if (catalogHeading) catalogHeading.textContent = `Hasil pencarian · ${currentBooksQuery.trim()}`;

      const matches = state.catalogBooks.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      );

      if (catalogGrid) {
        catalogGrid.innerHTML =
          matches.length > 0
            ? matches.map((b) => createBookCardHTML(b, true)).join("")
            : `<p class="section-meta">Tidak ditemukan buku yang cocok dengan "${esc(currentBooksQuery.trim())}".</p>`;
      }
      return;
    }

    if (currentBooksCategory === "All") {
      if (catalogSection) catalogSection.classList.remove("hidden");
      if (catalogHeading) catalogHeading.textContent = "Direkomendasikan untuk Anda";
      if (catalogGrid) {
        catalogGrid.innerHTML =
          state.catalogBooks.length > 0
            ? state.catalogBooks.map((b) => createBookCardHTML(b, true)).join("")
            : `<p class="section-meta">Belum ada buku tersedia di katalog.</p>`;
      }

      if (loansCategoryBanner) loansCategoryBanner.classList.add("hidden");
      if (loansSection) {
        loansSection.classList.toggle("hidden", state.activeLoans.length === 0);
      }
      if (loansGrid) {
        loansGrid.innerHTML = state.activeLoans.map(createLoanCardHTML).join("");
      }
      return;
    }

    const catCatalog = state.catalogBooks.filter(
      (b) => b.category.toLowerCase() === currentBooksCategory.toLowerCase()
    );
    const catLoans = state.activeLoans.filter(
      (l) => l.category.toLowerCase() === currentBooksCategory.toLowerCase()
    );

    if (catCatalog.length > 0) {
      if (catalogSection) catalogSection.classList.remove("hidden");
      if (catalogHeading) catalogHeading.textContent = `Kategori ${currentBooksCategory}`;
      if (catalogGrid) {
        catalogGrid.innerHTML = catCatalog.map((b) => createBookCardHTML(b, true)).join("");
      }
    } else {
      if (catalogSection) catalogSection.classList.add("hidden");
    }

    if (catLoans.length > 0) {
      if (loansSection) loansSection.classList.remove("hidden");
      if (loansCategoryBanner) {
        if (catCatalog.length === 0) {
          loansCategoryBanner.textContent = `Buku kategori ${currentBooksCategory} sedang Anda pinjam`;
          loansCategoryBanner.classList.remove("hidden");
        } else {
          loansCategoryBanner.classList.add("hidden");
        }
      }
      if (loansGrid) {
        loansGrid.innerHTML = catLoans.map(createLoanCardHTML).join("");
      }
    } else {
      if (loansSection) loansSection.classList.add("hidden");
      if (loansCategoryBanner) loansCategoryBanner.classList.add("hidden");
    }
  }

  window.filterBooksCategory = function (category, btn) {
    currentBooksCategory = category;
    currentBooksQuery = "";
    const searchInput = document.getElementById("books-search-input");
    if (searchInput) searchInput.value = "";

    document.querySelectorAll("#books-pills .pill-btn").forEach((p) => p.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderBooksCatalogAndLoans();
  };

  window.submitBooksSearch = function (e) {
    e.preventDefault();
    const input = document.getElementById("books-search-input");
    currentBooksQuery = input ? input.value.trim() : "";

    if (!currentBooksQuery) {
      currentBooksCategory = "All";
      document.querySelectorAll("#books-pills .pill-btn").forEach((p, idx) => {
        p.classList.toggle("active", idx === 0);
      });
    } else {
      document.querySelectorAll("#books-pills .pill-btn").forEach((p) => p.classList.remove("active"));
    }
    renderBooksCatalogAndLoans();
  };

  function renderBookDetail(bookId) {
    const book = state.catalogBooks.find(
      (b) => String(b.id) === String(bookId) || String(b.databaseId) === String(bookId)
    );
    if (!book) {
      window.location.href = buildPageUrl("buku");
      return;
    }

    const coverEl = document.getElementById("detail-book-cover");
    const catEl = document.getElementById("detail-book-category");
    const titleEl = document.getElementById("detail-book-title");
    const authorEl = document.getElementById("detail-book-author");
    const copiesEl = document.getElementById("detail-book-copies");
    const synopsisEl = document.getElementById("detail-book-synopsis");
    const borrowBtn = document.getElementById("detail-borrow-btn");

    if (coverEl) {
      coverEl.src = book.cover;
      coverEl.alt = book.title;
    }
    if (catEl) catEl.textContent = book.category;
    if (titleEl) titleEl.textContent = book.title;
    if (authorEl) authorEl.textContent = book.author;
    if (copiesEl) {
      copiesEl.textContent = Number(book.copies) > 0
        ? `Tersedia · ${book.copies} eksemplar`
        : "Stok habis · 0 eksemplar";
    }
    if (synopsisEl) synopsisEl.textContent = book.synopsis;

    const existingLoan = state.activeLoans.find((l) => l.id === book.id);
    if (borrowBtn) {
      if (existingLoan) {
        borrowBtn.textContent = existingLoan.pending
          ? "Menunggu konfirmasi admin"
          : "Sudah ada di Pinjaman Saya";
        borrowBtn.disabled = true;
      } else if (Number(book.copies) <= 0) {
        borrowBtn.textContent = "Stok buku habis";
        borrowBtn.disabled = true;
      } else if (state.activeLoans.length >= 5) {
        borrowBtn.textContent = "Batas maksimal 5 buku tercapai";
        borrowBtn.disabled = true;
      } else {
        borrowBtn.textContent = "Pinjam buku";
        borrowBtn.disabled = false;
        borrowBtn.onclick = function () {
          borrowBookFromDetail(book.id);
        };
      }
    }
  }

  async function borrowBookFromDetail(bookId) {
    const book = state.catalogBooks.find((b) => b.id === bookId);
    if (!book) return;
    if (state.activeLoans.some((l) => l.id === book.id)) return;
    if (Number(book.copies) <= 0) {
      showToast("Stok buku ini sedang habis.");
      return;
    }
    if (state.activeLoans.length >= 5) {
      showToast("Maksimal peminjaman 5 buku aktif.");
      return;
    }

    const borrowButton = document.getElementById("detail-borrow-btn");
    if (borrowButton) {
      borrowButton.disabled = true;
      borrowButton.textContent = "Memproses...";
    }

    try {
      const response = await fetch("/api/loans", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: book.databaseId || null,
          title: book.title
        })
      });
      if (response.status === 401) {
        window.location.href = buildPageUrl("index");
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Peminjaman gagal disimpan");
      }

      await syncCatalogAndLoansFromApi();
      state.user.monthlyBorrowed = Math.max(
        state.user.monthlyBorrowed,
        state.activeLoans.length
      );
      saveState();
      const created = state.activeLoans.find((l) => l.id === book.id);
      showToast(
        created
          ? `Booking berhasil. Tunjukkan nomor ${created.loanNumber} ke resepsionis dalam 24 jam.`
          : `Booking "${book.title}" berhasil.`
      );
      refreshCurrentPage();
      renderBookDetail(book.id);
    } catch (error) {
      showToast(error.message);
      if (borrowButton) {
        borrowButton.disabled = false;
        borrowButton.textContent = "Pinjam buku";
      }
    }
  }

  // =========================================================
  // PAGE: PINJAMAN SAYA (pinjaman.html)
  // =========================================================
  function initLoansPage() {
    const activeStatEl = document.getElementById("loans-stat-active");
    const monthlyStatEl = document.getElementById("loans-stat-monthly");
    const activeGrid = document.getElementById("loans-active-grid");
    const historyContainer = document.getElementById("loans-history-container");

    if (activeStatEl) activeStatEl.textContent = padTwo(state.activeLoans.length);
    if (monthlyStatEl) monthlyStatEl.textContent = padTwo(state.user.monthlyBorrowed);

    if (activeGrid) {
      activeGrid.innerHTML =
        state.activeLoans.length > 0
          ? state.activeLoans.map(createLoanCardHTML).join("")
          : `<p class="section-meta">Belum ada pinjaman aktif saat ini.</p>`;
    }

    if (historyContainer) {
      historyContainer.innerHTML =
        state.loanHistory.length === 0
          ? `<p class="empty-history-text">Belum ada pengembalian pada periode ini. Pinjaman yang selesai akan muncul di sini.</p>`
          : `<div class="loans-grid">${state.loanHistory.map(createHistoryCardHTML).join("")}</div>`;
    }
    renderMonthlyStatCards();
  }

  // =========================================================
  // PAGE: PROFILE (profile.html)
  // =========================================================
  function initProfilePage() {
    const bannerEl = document.getElementById("profile-updated-banner");
    const headerNameEl = document.getElementById("profile-header-name");
    const headerRoleEl = document.getElementById("profile-header-role");
    const npmEl = document.getElementById("profile-npm");
    const prodiEl = document.getElementById("profile-prodi");
    const phoneEl = document.getElementById("profile-phone");
    const fullNameEl = document.getElementById("profile-fullname");
    const emailEl = document.getElementById("profile-email");
    const memberIdEl = document.getElementById("profile-member-id");

    if (bannerEl) {
      bannerEl.textContent = "Profil berhasil diperbarui";
      bannerEl.classList.toggle("hidden", !state.profileUpdatedDemo);
    }
    if (state.profileUpdatedDemo) {
      state.profileUpdatedDemo = false;
      saveState();
    }
    if (headerNameEl) headerNameEl.textContent = state.user.fullName || "-";
    if (headerRoleEl) headerRoleEl.textContent = state.user.status;

    if (npmEl) npmEl.textContent = state.user.npm;
    if (prodiEl) prodiEl.textContent = state.user.prodi;
    if (phoneEl) phoneEl.textContent = state.user.phone;
    if (fullNameEl) fullNameEl.textContent = state.user.fullName || "-";
    if (emailEl) emailEl.textContent = state.user.email;
    if (memberIdEl) memberIdEl.textContent = state.user.memberId;
  }

  window.openEditProfileModal = function () {
    const nameInput = document.getElementById("edit-fullname");
    const emailInput = document.getElementById("edit-email");
    const phoneInput = document.getElementById("edit-phone");
    const prodiInput = document.getElementById("edit-prodi");

    if (nameInput) nameInput.value = state.user.fullName;
    if (emailInput) emailInput.value = state.user.email === "-" ? "" : state.user.email;
    if (phoneInput) {
      phoneInput.value = state.user.phone === "Belum ditambahkan" ? "" : state.user.phone;
    }
    if (prodiInput) {
      prodiInput.value = state.user.prodi === "Belum diisi" ? "" : state.user.prodi;
    }
    openModal("modal-edit-profile");
  };

  window.handleSaveProfile = async function (e) {
    e.preventDefault();
    const nameVal = document.getElementById("edit-fullname").value.trim();
    const emailVal = document.getElementById("edit-email").value.trim();
    const phoneVal = document.getElementById("edit-phone").value.trim();
    const prodiVal = document.getElementById("edit-prodi").value.trim();

    if (nameVal.length < 3) {
      showToast("Nama lengkap minimal 3 karakter.");
      return;
    }
    if (phoneVal && !/^08[0-9]{8,11}$/.test(phoneVal)) {
      showToast("Nomor HP harus diawali 08 dan terdiri dari 10-13 digit angka.");
      return;
    }

    const tombol = e.target.querySelector('button[type="submit"]');
    if (tombol) tombol.disabled = true;

    try {
      await window.LibraryApi.updateProfile({
        name: nameVal,
        email: emailVal,
        phone: phoneVal,
        prodi: prodiVal,
        program_study: prodiVal
      });
      await syncCatalogAndLoansFromApi();
      state.profileUpdatedDemo = true;
      closeModal("modal-edit-profile");
      initSharedShell("profile");
      initProfilePage();
      saveState();
      showToast("Profil berhasil diperbarui.");
    } catch (error) {
      if (error && error.status === 401) {
        window.location.href = buildPageUrl("index");
        return;
      }
      showToast(error.message);
    } finally {
      if (tombol) tombol.disabled = false;
    }
  };

  window.handleLogout = async function () {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch (e) {
      /* abaikan: tetap lanjut ke halaman login */
    }
    state.isLoggedIn = false;
    saveState();
    window.location.href = buildPageUrl("index");
  };

  // =========================================================
  // SINKRON DATA DARI SERVER (buku dari database)
  // =========================================================
  async function syncCatalogAndLoansFromApi() {
    try {
      const results = await Promise.all([
        window.LibraryApi.getBooks(),
        window.LibraryApi.getLoans(),
        window.LibraryApi.getProfile(),
        window.LibraryApi.getNotifications()
      ]);
      state.catalogBooks = results[0];
      state.activeLoans = results[1].loans;
      state.loanHistory = results[1].history;
      state.user.monthlyBorrowed = results[1].monthlyBorrowed;

      const p = results[2];
      state.user.fullName = p.name;
      state.user.npm = p.npm;
      state.user.memberId = p.code;
      state.user.email = p.email;
      state.user.phone = p.phone || "Belum ditambahkan";
      state.user.prodi = p.prodi || p.program_study || "Belum diisi";
      state.user.status = "Anggota";
      state.user.visitsThisMonth = p.visits_this_month;

      state.notifications = applyLocalReadStatus(results[3]);
    } catch (error) {
      if (error.status === 401) {
        window.location.href = buildPageUrl("index");
        return;
      }
      console.warn("Gagal mengambil data dari server:", error);
      showToast("Gagal memuat data dari server.");
    }
  }

  // =========================================================
  // BOOTSTRAP PAGE ON LOAD
  // =========================================================
  function refreshCurrentPage() {
    const page = document.body.getAttribute("data-page");
    if (page === "home") initHomePage();
    if (page === "buku") initBooksPage();
    if (page === "pinjaman") initLoansPage();
    if (page === "profile") initProfilePage();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const page = document.body.getAttribute("data-page");
    if (!page || page === "auth") return;

    const editPhone = document.getElementById("edit-phone");
    if (editPhone) {
      editPhone.addEventListener("input", function (e) {
        e.target.value = e.target.value.replace(/\D/g, "");
      });
    }

    syncCatalogAndLoansFromApi().finally(function () {
      initSharedShell(page);
      refreshCurrentPage();
    });
  });
})();
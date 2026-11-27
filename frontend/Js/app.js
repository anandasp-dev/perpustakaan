/* =========================================================
   UNINDRA LIBRARY — UNIFIED APPLICATION SCRIPT (MULTI-PAGE)
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "unindra_library_state_v1";

  // Data awal sesuai desain Figma
  const DEFAULT_STATE = {
    isLoggedIn: false,
    role: "member",
    user: {
      fullName: "Maya Putri",
      npm: "202511223344",
      memberId: "MB-0108",
      prodi: "Teknik Informatika (S1)",
      email: "Maya@gmail.com",
      phone: "Belum ditambahkan",
      status: "Mahasiswa",
      visits: 12,
      monthlyBorrowed: 6
    },
    eventSaved: false,
    profileUpdatedDemo: false,
    catalogBooks: [
      {
        id: "braiding-sweetgrass",
        title: "Braiding Sweetgrass",
        author: "Robin Wall Kimmerer",
        category: "Nature",
        copies: 6,
        cover: "assets/Book cover.png",
        synopsis:
          "Kumpulan esai yang mempertemukan pengetahuan tumbuhan, sains, dan hubungan manusia dengan alam."
      },
      {
        id: "sapiens",
        title: "Sapiens",
        author: "Yuval Noah Harari",
        category: "History",
        copies: 7,
        cover: "assets/Book cover2.png",
        synopsis:
          "Perjalanan sejarah manusia dari masyarakat awal hingga dunia modern."
      },
      {
        id: "the-little-prince",
        title: "The Little Prince",
        author: "Antoine de Saint-Exupéry",
        category: "Fiction",
        copies: 9,
        cover: "assets/Book cover3.png",
        synopsis:
          "Kisah seorang pangeran kecil tentang persahabatan, perjalanan, dan hal-hal yang berharga."
      }
    ],
    activeLoans: [
      {
        id: "the-creative-act",
        title: "The Creative Act",
        subtitle: "The Creative Act",
        author: "Rick Rubin",
        category: "Arts",
        borrowDate: "28 Sep 2026",
        dueDate: "12 Oct 2026",
        extendedDueDate: "19 Oct 2026",
        daysLeftText: "7 hari tersisa",
        renewed: false,
        coverTheme: "theme-ochre",
        coverImage: ""
      },
      {
        id: "the-midnight-library",
        title: "The Midnight Library",
        subtitle: "The Midnight Library",
        author: "Matt Haig",
        category: "Fiction",
        borrowDate: "01 Oct 2026",
        dueDate: "15 Oct 2026",
        extendedDueDate: "22 Oct 2026",
        daysLeftText: "10 hari tersisa",
        renewed: false,
        coverTheme: "theme-forest",
        coverImage: ""
      }
    ],
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
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(saved));
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Gagal menyimpan ke localStorage:", e);
    }
  }

  // =========================================================
  // HELPERS & UI UTILITIES
  // =========================================================
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

  // gaya tanggal di banner Home: "MONDAY, 23 NOVEMBER 2026"
  function formatHeroDate(d) {
    return HARI_EN[d.getDay()] + ", " + padTwo(d.getDate()) + " " + BULAN_EN[d.getMonth()] + " " + d.getFullYear();
  }

  function findStatCard(label) {
    return Array.from(document.querySelectorAll(".stat-card")).find(function (card) {
      const el = card.querySelector(".stat-label");
      return el && el.textContent.trim() === label;
    });
  }

  // nama bulan di kartu statistik + angka kunjungan bulan ini (dari database)
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

  // Tutup modal jika klik di area backdrop
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

  // =========================================================
  // AUTHENTICATION PAGE (index.html)
  // =========================================================
  window.switchAuthTab = function (tab) {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const headerLogin = document.getElementById("auth-header-login");
    const headerRegister = document.getElementById("auth-header-register");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");

    if (!loginForm || !registerForm) return;

    if (tab === "register") {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      headerLogin.classList.add("hidden");
      headerRegister.classList.remove("hidden");
      tabLogin.classList.remove("active");
      tabRegister.classList.add("active", "register-mode");
    } else {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      headerRegister.classList.add("hidden");
      headerLogin.classList.remove("hidden");
      tabRegister.classList.remove("active", "register-mode");
      tabLogin.classList.add("active");
    }
  };

  window.togglePassword = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.style.color = isPassword ? "#16325c" : "";
  };

  window.selectDemoAccount = function (role) {
    const idInput = document.getElementById("login-identifier");
    const passInput = document.getElementById("login-password");
    switchAuthTab("login");
    if (role === "admin") {
      if (idInput) idInput.value = "admin@unindra.ac.id";
      if (passInput) passInput.value = "admin12345";
      showToast("Akun demo Admin dipilih. Klik Login untuk melanjutkan.");
    } else {
      if (idInput) idInput.value = "202511223344";
      if (passInput) passInput.value = "member12345";
      showToast("Akun demo Member dipilih. Klik Login untuk melanjutkan.");
    }
    closeModal("modal-demo");
  };

  window.fillSampleRegister = function () {
    const nameEl = document.getElementById("reg-name");
    const npmEl = document.getElementById("reg-npm");
    const emailEl = document.getElementById("reg-email");
    const phoneEl = document.getElementById("reg-phone");
    const passEl = document.getElementById("reg-password");
    const confirmEl = document.getElementById("reg-confirm");
    const termsEl = document.getElementById("reg-terms");

    if (nameEl) nameEl.value = "Maya Putri";
    if (npmEl) npmEl.value = "202511223344";
    if (emailEl) emailEl.value = "maya.putri@example.com";
    if (phoneEl) phoneEl.value = "081234567890";
    if (passEl) passEl.value = "Unindra2026";
    if (confirmEl) confirmEl.value = "Unindra2026";
    if (termsEl) termsEl.checked = true;
    showToast("Data contoh Member berhasil diisi.");
  };

  window.handleLogin = function (e) {
    e.preventDefault();
    const identifier = (document.getElementById("login-identifier").value || "").trim();
    if (!identifier) return;

    if (identifier.toLowerCase() === "admin@unindra.ac.id" || identifier.toLowerCase().includes("admin")) {
      state.isLoggedIn = true;
      state.role = "admin";
      saveState();
      openModal("modal-admin-notice");
      return;
    }

    // Login sebagai Member
    state.isLoggedIn = true;
    state.role = "member";
    if (identifier !== "202511223344" && !identifier.includes("@")) {
      state.user.npm = identifier;
    }
    saveState();
    window.location.href = "dashboard.html";
  };

  window.handleRegister = function (e) {
    e.preventDefault();
    const fullName = document.getElementById("reg-name").value.trim();
    const npm = document.getElementById("reg-npm").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const pass = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;

    if (pass !== confirm) {
      showToast("Konfirmasi password tidak cocok.");
      return;
    }

    state.isLoggedIn = true;
    state.role = "member";
    state.user.fullName = fullName || "Maya Putri";
    state.user.npm = npm || "202511223344";
    state.user.email = email || "Maya@gmail.com";
    state.user.phone = phone || "Belum ditambahkan";
    saveState();
    window.location.href = "dashboard.html";
  };

  window.handleForgotSubmit = function (e) {
    e.preventDefault();
    closeModal("modal-forgot");
    openModal("modal-reset-sent");
  };

  window.handleLogout = function () {
    state.isLoggedIn = false;
    saveState();
    window.location.href = "index.html";
  };

  // =========================================================
  // SHARED NAVBAR, NOTIFICATIONS & RENEWAL MODALS
  // =========================================================
  function initSharedShell(pageName) {
    // Proteksi sederhana agar halaman member selalu punya state valid
    if (!state.isLoggedIn) {
      state.isLoggedIn = true;
      state.role = "member";
      saveState();
    }

    // Highlight menu aktif
    document.querySelectorAll(".nav-item[data-nav]").forEach((el) => {
      if (el.getAttribute("data-nav") === pageName) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });

    // Inisial avatar navbar
    const avatarChip = document.getElementById("navbar-avatar");
    if (avatarChip) {
      avatarChip.textContent = getInitials(state.user.fullName);
    }

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
      await window.LibraryApi.markNotificationsRead();   // tersimpan di database
      state.notifications.forEach((n) => (n.unread = false));
      renderNotificationDropdown();
      showToast("Semua notifikasi ditandai sudah dibaca.");
    } catch (error) {
      showToast(error.message);
    }
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
    if (countEl) countEl.textContent = `${unreadCount} unread`;
    if (dotEl) dotEl.classList.toggle("hidden", unreadCount === 0);

    listEl.innerHTML = state.notifications
      .map(
        (item) => `
      <div class="notif-drop-item" onclick="openMemberNotificationsModal()">
        <div class="notif-item-icon ${item.type}">${getNotifSvg(item.icon)}</div>
        <div class="notif-item-body">
          <div class="notif-item-title">${item.title}</div>
          <div class="notif-item-desc">${item.desc}</div>
        </div>
        <div class="notif-item-meta">
          <span class="notif-item-time">${item.time}</span>
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
      container.innerHTML = state.activeLoans
        .map((loan) => {
          if (loan.pending) {
            return `
              <div class="modal-notif-item">
                <div class="modal-notif-title">${loan.title}</div>
                <div class="modal-notif-sub">Menunggu konfirmasi · batas ${loan.confirmDeadline}</div>
              </div>
            `;
          }

          const activeDue = loan.renewed ? loan.extendedDueDate : loan.dueDate;
          const statusNote = loan.renewed
            ? "Diperpanjang 1 kali"
            : loan.daysLeftText.replace("tersisa", "lagi");
          return `
            <div class="modal-notif-item">
              <div class="modal-notif-title">${loan.title}</div>
              <div class="modal-notif-sub">Jatuh tempo ${activeDue} · ${statusNote}</div>
            </div>
          `;
        })
        .join("");
      if (state.notifications.length === 0) {
      listEl.innerHTML =
        '<div class="notif-drop-item"><div class="notif-item-body">' +
        '<div class="notif-item-desc">Belum ada notifikasi.</div></div></div>';
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
      ? `<img src="${loan.coverImage}" alt="${loan.title}" class="loan-cover-img" />`
      : `<div class="loan-cover-art ${loan.coverTheme || "theme-ochre"}">
           <div class="loan-cover-art-title">${loan.title}</div>
           <div class="loan-cover-art-author">${loan.author}</div>
         </div>`;

    const badgeClass = pending ? "pending" : loan.renewed ? "renewed" : "";
    const badgeText = pending ? "Tunggu konfirmasi" : loan.renewed ? "Diperpanjang" : "Dipinjam";

    const datesMarkup = pending
      ? `<div>
           <div class="loan-date-label">No. pinjaman</div>
           <div class="loan-date-value">${loan.loanNumber}</div>
         </div>
         <div>
           <div class="loan-date-label">Konfirmasi paling lambat</div>
           <div class="loan-date-value">${loan.confirmDeadline}</div>
         </div>`
      : `<div>
           <div class="loan-date-label">Tanggal pinjam</div>
           <div class="loan-date-value">${loan.borrowDate}</div>
         </div>
         <div>
           <div class="loan-date-label">Batas pengembalian</div>
           <div class="loan-date-value">${activeDue}</div>
         </div>`;

    const bottomMarkup = pending
      ? `<span class="loan-remaining">Sisa waktu
           <strong class="loan-countdown" data-expires="${loan.expiresAt}">${formatCountdown(loan.expiresAt - Date.now())}</strong>
         </span>
         <button type="button" class="btn-renew btn-cancel" onclick="openCancelModal('${loan.id}')">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="18" y1="6" x2="6" y2="18"></line>
             <line x1="6" y1="6" x2="18" y2="18"></line>
           </svg>
           <span>Batalkan peminjaman</span>
         </button>`
      : `<span class="loan-remaining">${remainingText}</span>
         <button
           type="button"
           class="btn-renew"
           ${loan.renewed ? "disabled" : ""}
           onclick="openRenewModal('${loan.id}')"
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
            <h3 class="loan-title">${loan.title}</h3>
            <div class="loan-subtitle">${loan.subtitle || loan.title}</div>
            <div class="loan-author">${loan.author}</div>
            <div class="loan-borrower">Peminjam: ${state.user.fullName}</div>
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
      ? `<img src="${item.coverImage}" alt="${item.title}" class="loan-cover-img" />`
      : `<div class="loan-cover-art ${item.coverTheme || "theme-ochre"}">
           <div class="loan-cover-art-title">${item.title}</div>
           <div class="loan-cover-art-author">${item.author}</div>
         </div>`;

    return `
      <article class="loan-card">
        <div class="loan-card-top">
          ${coverMarkup}
          <div class="loan-info">
            <span class="badge-status renewed">Dikembalikan</span>
            <h3 class="loan-title">${item.title}</h3>
            <div class="loan-subtitle">${item.title}</div>
            <div class="loan-author">${item.author}</div>
          </div>
        </div>
        <div class="loan-dates-row">
          <div>
            <div class="loan-date-label">Tanggal pinjam</div>
            <div class="loan-date-value">${item.borrowDate}</div>
          </div>
          <div>
            <div class="loan-date-label">Tanggal kembali</div>
            <div class="loan-date-value">${item.returnedDate}</div>
          </div>
        </div>
        <div class="loan-card-bottom">
          <span class="loan-remaining">${item.note}</span>
        </div>
      </article>
    `;
  }

  function createBookCardHTML(book, includeActionButton) {
    return `
      <div class="book-item-wrapper">
        <article class="book-card">
          <img src="${book.cover}" alt="${book.title}" class="book-thumb" />
          <div class="book-card-body">
            <h3 class="book-card-title">${book.title}</h3>
            <div class="book-card-author">${book.author}</div>
            <div class="book-card-meta">${book.copies} copies available · ${book.category}</div>
            <a href="buku.html?id=${book.id}" class="book-card-link">Lihat buku →</a>
          </div>
        </article>
        ${
          includeActionButton
            ? `<a href="buku.html?id=${book.id}" class="btn btn-primary btn-block">Lihat detail &amp; pinjam</a>`
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
      await window.LibraryApi.renewLoan(loan.loanId);   // minta server memperpanjang
      await syncCatalogAndLoansFromApi();               // ambil data terbaru
      closeModal("modal-renew-confirm");
      openModal("modal-renew-complete");
      refreshCurrentPage();
    } catch (error) {
      closeModal("modal-renew-confirm");
      showToast(error.message);                         // mis. "Pinjaman ini sudah diperpanjang 1 kali"
    }
  };

  // =========================================================
  // HITUNG MUNDUR & PEMBATALAN BOOKING
  // =========================================================
  let countdownTimer = null;
  let countdownRefreshing = false;
  let pendingCancelLoanId = null;
  let notifTimer = null;
    // cek notifikasi baru tiap 60 detik (mis. setelah admin mengonfirmasi bukumu)
  
  function startNotificationPolling() {
    if (notifTimer) return;
    notifTimer = setInterval(async function () {
      try {
        state.notifications = await window.LibraryApi.getNotifications();
        renderNotificationDropdown();
      } catch (error) {
        /* abaikan, coba lagi 60 detik berikutnya */
      }
    }, 60000);
  }

  // milidetik -> "23:41:12"
  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return padTwo(h) + ":" + padTwo(m) + ":" + padTwo(s);
  }

  // Satu "jam weker" untuk semua kartu pending: tiap detik angkanya diperbarui.
  // Kalau ada yang sudah habis, ambil data terbaru dari server (booking hangus hilang dari daftar).
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

  // Jendela konfirmasi dibuat lewat JS dengan class yang sama seperti jendela Perpanjang,
  // jadi tidak perlu mengubah HTML di tiga halaman.
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
      showToast(error.message);   // mis. booking ternyata sudah hangus atau sudah dikonfirmasi
    }
    await syncCatalogAndLoansFromApi();   // apa pun hasilnya, tampilkan data terbaru
    refreshCurrentPage();
  };

  // =========================================================
  // PAGE: HOME (dashboard.html)
  // =========================================================
  function initHomePage() {
    const firstName = (state.user.fullName || "Maya").split(" ")[0];
    const greetingEl = document.getElementById("home-greeting");
    const metaEl = document.getElementById("home-member-meta");
    const activeStatEl = document.getElementById("stat-active-loans");
    const monthlyStatEl = document.getElementById("stat-monthly-loans");
    const loansContainer = document.getElementById("home-loans-grid");
    const eventBtn = document.getElementById("btn-save-seat");
    const heroDate = document.querySelector(".hero-date");

    if (greetingEl) greetingEl.textContent = `A new chapter, ${firstName}.`;
    if (metaEl) {
      metaEl.textContent = `${state.user.fullName} · NPM ${state.user.npm} · ${state.user.memberId} · Active member`;
    }
    if (activeStatEl) activeStatEl.textContent = padTwo(state.activeLoans.length);
    if (monthlyStatEl) monthlyStatEl.textContent = padTwo(state.user.monthlyBorrowed);

    if (loansContainer) {
      loansContainer.innerHTML = state.activeLoans.map(createLoanCardHTML).join("");
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
      grid.innerHTML = `<p class="section-meta">Buku kategori ${currentHomeCategory} sedang dipinjam atau belum tersedia di rak rekomendasi.</p>`;
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
    if (!query) {
      window.location.href = "buku.html";
      return;
    }
    window.location.href = `buku.html?q=${encodeURIComponent(query)}`;
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

    // Mode Pencarian
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
            : `<p class="section-meta">Tidak ditemukan buku yang cocok dengan "${currentBooksQuery.trim()}".</p>`;
      }
      return;
    }

    // Mode Semua Buku
    if (currentBooksCategory === "All") {
      if (catalogSection) catalogSection.classList.remove("hidden");
      if (catalogHeading) catalogHeading.textContent = "Direkomendasikan untuk Anda";
      if (catalogGrid) {
        catalogGrid.innerHTML = state.catalogBooks.map((b) => createBookCardHTML(b, true)).join("");
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

    // Mode Filter Kategori Spesifik (Fiction, Arts, History, Nature)
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
    const book = state.catalogBooks.find((b) => b.id === bookId) || state.catalogBooks[0];
    if (!book) return;

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
    if (copiesEl) copiesEl.textContent = `Tersedia · ${book.copies} eksemplar`;
    if (synopsisEl) synopsisEl.textContent = book.synopsis;

    const alreadyBorrowed = state.activeLoans.some((l) => l.id === book.id);
    if (borrowBtn) {
      if (alreadyBorrowed) {
        borrowBtn.textContent = state.activeLoans.find((l) => l.id === book.id).pending
          ? "Menunggu konfirmasi admin"
          : "Sudah ada di Pinjaman Saya";
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: book.databaseId || null,
          title: book.title
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
      state.user.monthlyBorrowed = Math.max(
        state.user.monthlyBorrowed,
        state.activeLoans.length
      );
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
    state.profileUpdatedDemo = false;   // banner hanya tampil sekali, tepat setelah menyimpan
    if (headerNameEl) headerNameEl.textContent = state.user.fullName;
    if (headerRoleEl) headerRoleEl.textContent = state.user.status;

    if (npmEl) npmEl.textContent = state.user.npm;
    if (prodiEl) prodiEl.textContent = state.user.prodi;
    if (phoneEl) phoneEl.textContent = state.user.phone;
    if (fullNameEl) fullNameEl.textContent = state.user.fullName;
    if (emailEl) emailEl.textContent = state.user.email;
    if (memberIdEl) memberIdEl.textContent = state.user.memberId;
  }

  window.openEditProfileModal = function () {
    const nameInput = document.getElementById("edit-fullname");
    const emailInput = document.getElementById("edit-email");
    const phoneInput = document.getElementById("edit-phone");

    if (nameInput) nameInput.value = state.user.fullName;
    if (emailInput) emailInput.value = state.user.email;
    if (phoneInput) {
      phoneInput.value = state.user.phone === "Belum ditambahkan" ? "" : state.user.phone;
    }
    openModal("modal-edit-profile");
  };

  window.fillSampleProfileEdit = function () {
    const nameInput = document.getElementById("edit-fullname");
    const emailInput = document.getElementById("edit-email");
    const phoneInput = document.getElementById("edit-phone");

    if (nameInput) nameInput.value = "Maya Putri S.";
    if (emailInput) emailInput.value = "maya.putri@example.com";
    if (phoneInput) phoneInput.value = "0812 3456 7890";
    showToast("Contoh perubahan profil diisi.");
  };

  window.handleSaveProfile = async function (e) {
    e.preventDefault();
    const nameVal = document.getElementById("edit-fullname").value.trim();
    const emailVal = document.getElementById("edit-email").value.trim();
    const phoneVal = document.getElementById("edit-phone").value.trim();
    const tombol = e.target.querySelector('button[type="submit"]');
    if (tombol) tombol.disabled = true;

    try {
      await window.LibraryApi.updateProfile({ name: nameVal, email: emailVal, phone: phoneVal });
      await syncCatalogAndLoansFromApi();      // ambil profil terbaru dari database
      state.profileUpdatedDemo = true;
      closeModal("modal-edit-profile");
      initSharedShell("profile");
      initProfilePage();
      saveState();
      showToast("Profil berhasil diperbarui.");
    } catch (error) {
      showToast(error.message);                 // mis. "Email sudah dipakai akun lain"
    } finally {
      if (tombol) tombol.disabled = false;
    }
  };

  window.handleLogout = async function () {
    try {
      await fetch("/api/auth/logout", { method: "POST" });   // akhiri sesi di server juga
    } catch (e) {
      /* abaikan: tetap lanjut ke halaman login */
    }
    state.isLoggedIn = false;
    saveState();
    window.location.href = "/index";
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
      state.user.prodi = "Belum diisi";
      state.user.status = "Anggota";
      state.user.visitsThisMonth = p.visits_this_month;

      state.notifications = results[3];
    } catch (error) {
      if (error.status === 401) {
        window.location.href = "/Pages/index";
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

    syncCatalogAndLoansFromApi().finally(function () {
      initSharedShell(page);
      refreshCurrentPage();
    });
  });
})();
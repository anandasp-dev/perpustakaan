//NOTIFIKASI — panel lonceng admin, tersambung ke /api/admin/notifications & /api/notifications/read
(function () {
  "use strict";

  const bellBtn = document.getElementById("bellBtn");
  const notifPanel = document.getElementById("notifPanel");
  const notifCount = document.getElementById("notifCount");
  const bellDot = document.getElementById("bellDot");
  const markAll = document.getElementById("markAll");
  const notif = document.querySelector(".notif");
  if (!bellBtn || !notifPanel || !notif) return;

  const notifList = notifPanel.querySelector(".notif-list");
  const notifFoot = notifPanel.querySelector(".notif-foot");
  const STORAGE_KEY = "keyto_admin_read_notifs";
  const POLL_INTERVAL_MS = 30000;
  let daftarNotif = [];

  function esc(teks) {
    return String(teks || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getReadSet() {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveReadSet(set) {
    try {
      const arr = Array.from(set).slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function perbaruiJumlah() {
    const jumlah = daftarNotif.filter(function (item) {
      return Boolean(item.unread);
    }).length;
    if (notifCount) notifCount.textContent = jumlah + " belum dibaca";
    if (bellDot) bellDot.classList.toggle("hide", jumlah === 0);
  }

  async function simpanNotifSeenKeDatabase() {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        credentials: "same-origin"
      });
    } catch (e) {
      console.warn("Gagal memperbarui notif_seen_at:", e);
    }
  }

  function tandaiItemDibaca(key) {
    if (!key) return;
    const readSet = getReadSet();
    readSet.add(key);
    saveReadSet(readSet);

    let changed = false;
    daftarNotif.forEach(function (item) {
      if (item.key === key && item.unread) {
        item.unread = false;
        changed = true;
      }
    });

    notifPanel.querySelectorAll(".notif-item").forEach(function (el) {
      if (el.dataset.key === key) {
        el.classList.remove("unread");
        const dot = el.querySelector(".notif-dot");
        if (dot) dot.remove();
      }
    });

    perbaruiJumlah();

    if (changed) {
      const sisaUnread = daftarNotif.filter(function (item) { return item.unread; }).length;
      if (sisaUnread === 0) {
        simpanNotifSeenKeDatabase();
      }
    }
  }

  function renderNotifikasi() {
    if (!notifList) return;
    if (daftarNotif.length === 0) {
      notifList.innerHTML =
        '<div style="padding:24px 16px;text-align:center;color:#64748b;font-size:13px;">' +
        "Belum ada notifikasi.</div>";
      perbaruiJumlah();
      return;
    }

    notifList.innerHTML = daftarNotif.map(function (item) {
      const unread = Boolean(item.unread);
      const tone = ["blue", "gray", "red"].indexOf(item.tone) !== -1 ? item.tone : "blue";

      return '<div role="button" tabindex="0"' +
        ' class="notif-item' + (unread ? " unread" : "") + '"' +
        ' data-key="' + esc(item.key) + '"' +
        ' style="cursor:pointer;">' +
          '<span class="notif-icon ' + tone + '"><i data-lucide="' + esc(item.icon || "bell") + '"></i></span>' +
          '<div class="notif-text">' +
            "<b>" + esc(item.title) + "</b>" +
            "<small>" + esc(item.detail) + "</small>" +
          "</div>" +
          '<div class="notif-meta">' +
            "<span>" + esc(item.time) + "</span>" +
            (unread ? '<i class="notif-dot"></i>' : "") +
          "</div>" +
        "</div>";
    }).join("");

    if (window.lucide) window.lucide.createIcons();
    perbaruiJumlah();
  }

  function ensureAdminNotifModal() {
    let backdrop = document.getElementById("modal-admin-notifications");
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.id = "modal-admin-notifications";
    backdrop.className = "modal-backdrop hidden";
    backdrop.style.zIndex = "1100";
    backdrop.innerHTML =
      '<div class="modal-card" style="max-height:85vh;overflow-y:auto;">' +
        '<h3 class="modal-title">Notifikasi</h3>' +
        '<div class="modal-section-label">Pengingat &amp; aktivitas perpustakaan</div>' +
        '<div id="modal-admin-notif-list"></div>' +
        '<div class="modal-section-label">Pengumuman perpustakaan</div>' +
        '<div class="modal-notif-item">' +
          '<div class="modal-notif-title">Keyto-Library</div>' +
          '<div class="modal-notif-sub">Buka : Senin - Sabtu</div>' +
          '<div class="modal-notif-sub">Pukul : 08.00 - 17.00</div>' +
        '</div>' +
        '<div class="modal-actions-stack" style="margin-top:20px;">' +
          '<a href="admin?page=peminjaman" data-page="peminjaman" class="btn btn-primary btn-block" id="btn-admin-notif-loans">Lihat Peminjaman</a>' +
          '<button type="button" class="btn btn-outline btn-block" id="btn-admin-notif-close">Tutup</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    const closeBtn = backdrop.querySelector("#btn-admin-notif-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        backdrop.classList.add("hidden");
      });
    }

    const goLoansBtn = backdrop.querySelector("#btn-admin-notif-loans");
    if (goLoansBtn) {
      goLoansBtn.addEventListener("click", function () {
        backdrop.classList.add("hidden");
      });
    }

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) {
        backdrop.classList.add("hidden");
      }
    });

    return backdrop;
  }

  function tutupModalSemuaNotifikasi() {
    const backdrop = document.getElementById("modal-admin-notifications");
    if (backdrop) backdrop.classList.add("hidden");
  }

  function bukaModalSemuaNotifikasi(selectedKey) {
    notifPanel.classList.remove("show");
    const backdrop = ensureAdminNotifModal();
    const listBox = backdrop.querySelector("#modal-admin-notif-list");

    if (daftarNotif.length === 0) {
      listBox.innerHTML =
        '<div class="modal-notif-item">' +
          '<div class="modal-notif-sub">Belum ada aktivitas baru saat ini.</div>' +
        '</div>';
    } else {
      listBox.innerHTML = daftarNotif.map(function (item) {
        const unread = Boolean(item.unread);
        const isSelected = selectedKey && item.key === selectedKey;
        const hrefAttr = item.page ? "admin?page=" + esc(item.page) : "#";
        const pageAttr = item.page ? ' data-page="' + esc(item.page) + '"' : "";
        const highlightStyle = isSelected
          ? "background:#f2f6ff;border-radius:8px;padding:10px 12px;margin:2px 0;"
          : "";

        return '<a href="' + hrefAttr + '"' + pageAttr +
          ' class="modal-notif-item" data-modal-notif-key="' + esc(item.key) + '"' +
          ' style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;' + highlightStyle + '">' +
            '<div>' +
              '<div class="modal-notif-title">' + esc(item.title) + '</div>' +
              '<div class="modal-notif-sub">' + esc(item.detail) + '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:11.5px;color:#8898ad;margin-top:2px;">' +
              '<span>' + esc(item.time) + '</span>' +
              (unread ? '<span style="width:7px;height:7px;border-radius:50%;background:#1d63dc;display:inline-block;"></span>' : "") +
            '</div>' +
          '</a>';
      }).join("");

      listBox.querySelectorAll("[data-modal-notif-key]").forEach(function (link) {
        link.addEventListener("click", function () {
          tandaiItemDibaca(link.getAttribute("data-modal-notif-key"));
          tutupModalSemuaNotifikasi();
        });
      });
    }

    backdrop.classList.remove("hidden");
  }

  async function muatNotifikasi() {
    try {
      const res = await fetch("/api/admin/notifications", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json().catch(function () { return {}; });
      if (Array.isArray(data.notifications)) {
        const readSet = getReadSet();
        daftarNotif = data.notifications.map(function (item) {
          return Object.assign({}, item, {
            unread: Boolean(item.unread) && !readSet.has(item.key)
          });
        });
        renderNotifikasi();
      }
    } catch (e) {
      console.warn("Gagal memuat notifikasi:", e);
    }
  }

  bellBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    const akanBuka = !notifPanel.classList.contains("show");
    notifPanel.classList.toggle("show");
    if (akanBuka) muatNotifikasi();
  });

  document.addEventListener("click", function (e) {
    if (!notif.contains(e.target)) {
      notifPanel.classList.remove("show");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      notifPanel.classList.remove("show");
      tutupModalSemuaNotifikasi();
    }
  });

  if (markAll) {
    markAll.addEventListener("click", function () {
      const readSet = getReadSet();
      daftarNotif.forEach(function (item) {
        item.unread = false;
        readSet.add(item.key);
      });
      saveReadSet(readSet);
      notifPanel.querySelectorAll(".notif-item.unread").forEach(function (el) {
        el.classList.remove("unread");
        const dot = el.querySelector(".notif-dot");
        if (dot) dot.remove();
      });
      perbaruiJumlah();
      simpanNotifSeenKeDatabase();
    });
  }

  if (notifList) {
    notifList.addEventListener("click", function (e) {
      const item = e.target.closest(".notif-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const key = item.dataset.key;
      tandaiItemDibaca(key);
      bukaModalSemuaNotifikasi(key);
    });

    notifList.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest(".notif-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const key = item.dataset.key;
      tandaiItemDibaca(key);
      bukaModalSemuaNotifikasi(key);
    });
  }

  if (notifFoot) {
    notifFoot.setAttribute("href", "#");
    notifFoot.removeAttribute("data-page");
    notifFoot.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      bukaModalSemuaNotifikasi();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) muatNotifikasi();
  });

  muatNotifikasi();
  setInterval(muatNotifikasi, POLL_INTERVAL_MS);
})();
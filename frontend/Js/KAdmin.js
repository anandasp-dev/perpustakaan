if (window.lucide) lucide.createIcons();

(function () {
  "use strict";

  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const modal = document.getElementById("adminModal");
  const form = document.getElementById("adminForm");
  const editModal = document.getElementById("editAdminModal");
  const editForm = document.getElementById("editAdminForm");
  const deleteModal = document.getElementById("deleteAdminModal");
  const deleteForm = document.getElementById("deleteAdminForm");
  const tbody = document.getElementById("adminBody") || document.querySelector(".admin-table tbody");
  const inputCari = document.getElementById("cariAdmin") || document.querySelector(".search input");
  const btnOpenAdd = document.getElementById("openAddAdmin") || document.querySelector(".page-head .btn-primary");
  const colSpan = document.querySelectorAll(".admin-table thead th").length || 6;

  let daftarAdmin = [];
  let timerCari = null;

  function byIds() {
    for (let i = 0; i < arguments.length; i++) {
      const el = document.getElementById(arguments[i]);
      if (el) return el;
    }
    return null;
  }

  function escapeHtml(teks) {
    return String(teks || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTanggalWib(teks) {
    if (!teks) return "-";
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(teks));
    if (!m) return escapeHtml(teks);
    const tgl = m[3] + " " + BULAN[Number(m[2]) - 1] + " " + m[1];
    const jam = m[4] && m[5] ? "<small>" + m[4] + ":" + m[5] + " WIB</small>" : "";
    return '<div class="login-time">' + tgl + jam + "</div>";
  }

  function tampilToast(teks, galat) {
    let kotak = document.getElementById("admin-toast");
    if (!kotak) {
      kotak = document.createElement("div");
      kotak.id = "admin-toast";
      kotak.style.cssText =
        "position:fixed;right:24px;bottom:24px;z-index:9999;padding:12px 18px;" +
        "border-radius:12px;font-size:13px;font-weight:600;color:#fff;max-width:360px;" +
        "box-shadow:0 8px 24px rgba(15,23,42,.25);transition:opacity .25s;opacity:0;";
      document.body.appendChild(kotak);
    }
    kotak.style.background = galat ? "#dc2626" : "#16325c";
    kotak.textContent = teks;
    kotak.style.opacity = "1";
    clearTimeout(kotak._timer);
    kotak._timer = setTimeout(function () { kotak.style.opacity = "0"; }, 3500);
  }

  async function requestApi(url, opsi) {
    const res = await fetch(url, Object.assign({ credentials: "same-origin" }, opsi || {}));
    const data = await res.json().catch(function () { return {}; });
    if (res.status === 401) {
      window.location.href = "/index";
      throw new Error("Sesi berakhir");
    }
    if (!res.ok) {
      throw new Error(data.message || "Terjadi kesalahan pada server");
    }
    return data;
  }

  function getSearchValue() {
    return inputCari ? inputCari.value.trim() : "";
  }

  function renderTabel(list) {
    if (!tbody) return;
    daftarAdmin = list || [];
    if (!daftarAdmin.length) {
      tbody.innerHTML =
        '<tr><td colspan="' + colSpan + '" style="text-align:center;padding:24px;" class="muted">' +
        "Tidak ada data admin ditemukan.</td></tr>";
      return;
    }

    tbody.innerHTML = daftarAdmin.map(function (adm) {
      const aktif = adm.status === "active";
      const labelAnda = adm.is_self ? " &bull; Anda" : "";
      const badgeStatus = aktif
        ? '<span class="status status-active">Aktif</span>'
        : '<span class="status status-suspended">Tidak Aktif</span>';
      const tglDibekukan = !aktif && adm.deactivated_at
        ? formatTanggalWib(adm.deactivated_at)
        : '<span class="muted">-</span>';
      
      // Tambahkan baris ini untuk menonaktifkan tombol ubah jika akun sendiri
      const disableEdit = adm.is_self
        ? ' disabled style="opacity: 0.4; cursor: not-allowed;" title="Anda tidak dapat mengubah akun sendiri"'
        : "";
      
      const disableHapus = adm.is_self
        ? ' disabled title="Anda tidak dapat menghapus akun sendiri"'
        : "";

      return (
        '<tr data-id="' + adm.id + '">' +
        '<td><div class="admin-name"><b>' + escapeHtml(adm.name) + "</b>" +
        "<small>" + escapeHtml(adm.code) + labelAnda + "</small></div></td>" +
        "<td>" + escapeHtml(adm.email) + "</td>" +
        "<td>" + badgeStatus + "</td>" +
        "<td>" + formatTanggalWib(adm.created_at) + "</td>" +
        "<td>" + tglDibekukan + "</td>" +
        '<td><div class="actions">' +
        '<button type="button" class="icon-act icon-edit" aria-label="Ubah"' + disableEdit + '><i data-lucide="pencil"></i></button>' +
        '<button type="button" class="icon-act icon-delete" aria-label="Hapus"' + disableHapus + '><i data-lucide="trash-2"></i></button>' +
        "</div></td>" +
        "</tr>"
      );
    }).join("");

    if (window.lucide) lucide.createIcons();
  }

  async function muatAdmins(q) {
    if (!tbody) return;
    try {
      const query = q ? "?q=" + encodeURIComponent(q) : "";
      const data = await requestApi("/api/admin/admins" + query);
      if (data.summary) {
        const elTotal = document.getElementById("statAdminTotal");
        const elActive = document.getElementById("statAdminActive");
        const elInactive = document.getElementById("statAdminInactive");
        if (elTotal) elTotal.textContent = data.summary.total;
        if (elActive) elActive.textContent = data.summary.active;
        if (elInactive) elInactive.textContent = data.summary.inactive;
      }
      renderTabel(data.admins);
      const note = document.getElementById("adminTableNote");
      if (note) {
        note.textContent = "Menampilkan " + (data.admins ? data.admins.length : 0) +
          " akun admin \u2022 Cari berdasarkan nama atau email untuk mempersempit hasil.";
      }
    } catch (err) {
      tbody.innerHTML =
        '<tr><td colspan="' + colSpan + '" style="text-align:center;padding:24px;color:#dc2626;">' +
        escapeHtml(err.message) + "</td></tr>";
    }
  }

  function tutupSemua() {
    document.querySelectorAll(".modal-overlay").forEach(function (m) {
      m.classList.remove("show");
    });
  }

  if (btnOpenAdd && modal) {
    btnOpenAdd.addEventListener("click", function () {
      if (form) form.reset();
      modal.classList.add("show");
    });
  }

  ["aNpm", "aTelepon", "aphone", "eaNpm", "eaTelepon", "eaphone"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", function (e) {
        e.target.value = e.target.value.replace(/\D/g, "");
      });
    }
  });

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const password = (byIds("aPassword") || {}).value || "";
      const confirm = (byIds("aPasswordConfirm") || {}).value || "";

      if (password.length < 8) {
        tampilToast("Kata sandi minimal 8 karakter.", true);
        return;
      }
      if (password !== confirm) {
        tampilToast("Konfirmasi kata sandi tidak cocok.", true);
        return;
      }

      const tombol = form.querySelector('button[type="submit"]');
      if (tombol) tombol.disabled = true;
      try {
        const res = await requestApi("/api/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: (byIds("aNama") || {}).value || "",
            npm: (byIds("aNpm") || {}).value || "",
            email: (byIds("aEmail") || {}).value || "",
            phone: (byIds("aTelepon", "aphone") || {}).value || "",
            program_study: (byIds("aProdi", "aprogram_study") || {}).value || "",
            password: password,
            status: "active"
          })
        });
        tutupSemua();
        tampilToast(res.message || "Admin berhasil ditambahkan.");
        muatAdmins(getSearchValue());
      } catch (err) {
        tampilToast(err.message, true);
      } finally {
        if (tombol) tombol.disabled = false;
      }
    });
  }

  if (tbody) {
    tbody.addEventListener("click", function (e) {
      const tombol = e.target.closest(".icon-edit, .icon-delete");
      if (!tombol || tombol.disabled) return;

      const tr = tombol.closest("tr");
      const id = Number(tr.dataset.id);
      const adm = daftarAdmin.find(function (item) { return item.id === id; });
      if (!adm) return;

      if (tombol.classList.contains("icon-edit") && editModal) {
        const eaId = byIds("eaId");
        const eaSub = byIds("editAdminSub");
        const eaNama = byIds("eaNama");
        const eaNpm = byIds("eaNpm");
        const eaEmail = byIds("eaEmail");
        const eaTelepon = byIds("eaTelepon", "eaphone");
        const eaProdi = byIds("eaProdi", "eaprogram_study");
        const eaStatus = byIds("eaStatus");

        if (eaId) eaId.value = adm.id;
        if (eaSub) eaSub.textContent = adm.code + " \u2022 " + adm.name;
        if (eaNama) eaNama.value = adm.name || "";
        if (eaNpm) eaNpm.value = adm.npm || "";
        if (eaEmail) eaEmail.value = adm.email || "";
        if (eaTelepon) eaTelepon.value = adm.phone || "";
        if (eaProdi) eaProdi.value = adm.program_study || "";
        if (eaStatus) eaStatus.value = adm.status === "active" ? "active" : "inactive";
        editModal.classList.add("show");
      } else if (deleteModal) {
        const daId = byIds("daId");
        const daSub = byIds("deleteAdminSub");
        const daQuest = byIds("daQuestion");
        const daNama = byIds("daNama");
        const daEmail = byIds("daEmail");

        if (daId) daId.value = adm.id;
        if (daSub) daSub.textContent = adm.code + " \u2022 " + adm.name;
        if (daQuest) daQuest.textContent = "Hapus " + adm.name + " dari admin workspace?";
        if (daNama) daNama.textContent = adm.name;
        if (daEmail) daEmail.textContent = adm.email;
        deleteModal.classList.add("show");
      }
    });
  }

  if (editForm) {
    editForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const idEl = byIds("eaId");
      if (!idEl || !idEl.value) return;
      const tombol = editForm.querySelector('button[type="submit"]');
      if (tombol) tombol.disabled = true;
      try {
        const res = await requestApi("/api/admin/admins/" + idEl.value, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: (byIds("eaNama") || {}).value || "",
            npm: (byIds("eaNpm") || {}).value || "",
            email: (byIds("eaEmail") || {}).value || "",
            phone: (byIds("eaTelepon", "eaphone") || {}).value || "",
            program_study: (byIds("eaProdi", "eaprogram_study") || {}).value || "",
            status: (byIds("eaStatus") || {}).value || "active"
          })
        });
        tutupSemua();
        tampilToast(res.message || "Data admin berhasil diperbarui.");
        muatAdmins(getSearchValue());
      } catch (err) {
        tampilToast(err.message, true);
      } finally {
        if (tombol) tombol.disabled = false;
      }
    });
  }

  if (deleteForm) {
    deleteForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const idEl = byIds("daId");
      if (!idEl || !idEl.value) return;
      const tombol = deleteForm.querySelector('button[type="submit"]');
      if (tombol) tombol.disabled = true;
      try {
        const res = await requestApi("/api/admin/admins/" + idEl.value + "/delete", {
          method: "POST"
        });
        tutupSemua();
        tampilToast(res.message || "Akun admin berhasil dihapus.");
        muatAdmins(getSearchValue());
      } catch (err) {
        tampilToast(err.message, true);
      } finally {
        if (tombol) tombol.disabled = false;
      }
    });
  }

  const formCari = document.getElementById("formCariAdmin") || (inputCari && inputCari.closest("form"));
  if (formCari) {
    formCari.addEventListener("submit", function (e) { e.preventDefault(); });
  }
  if (inputCari) {
    inputCari.addEventListener("input", function () {
      clearTimeout(timerCari);
      timerCari = setTimeout(function () {
        muatAdmins(inputCari.value.trim());
      }, 300);
    });
  }

  document.querySelectorAll(".modal-overlay [data-close]").forEach(function (t) {
    t.addEventListener("click", tutupSemua);
  });
  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) tutupSemua();
    });
  });

  if (window._kadminEscKey) {
    document.removeEventListener("keydown", window._kadminEscKey);
  }
  window._kadminEscKey = function (e) {
    if (e.key === "Escape") tutupSemua();
  };
  document.addEventListener("keydown", window._kadminEscKey);

  muatAdmins();
})();
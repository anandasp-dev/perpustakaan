/* Kerangka admin: sidebar, topbar, profil admin, footer tetap; isi ditukar lewat ?page= tanpa reload */
(function () {
  "use strict";

  const DEFAULT_PAGE = "home";
  const BRAND = "Keyto Perpustakaan";
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const PAGES = {
    home:        { file: "/Pages/home",        title: "Home",         scripts: ["/Js/kalender.js", "/Js/script.js", "/Js/admin-dashboard.js"] },
    anggota:     { file: "/Pages/anggota",     title: "Anggota",      scripts: ["/Js/anggota.js", "/Js/script.js"] },
    KAdmin:      { file: "/Pages/KAdmin",      title: "Administrasi", scripts: ["/Js/KAdmin.js", "/Js/script.js"] },
    bukustorage: { file: "/Pages/bukustorage", title: "Buku",         scripts: ["/Js/buku.js", "/Js/script.js"] },
    peminjaman:  { file: "/Pages/peminjaman",  title: "Peminjaman",   scripts: ["/Js/peminjaman.js", "/Js/script.js"] },
    pengunjung:  { file: "/Pages/pengunjung",  title: "Pengunjung",   scripts: ["/Js/pengunjung.js", "/Js/script.js"] },
    laporan:     { file: "/Pages/laporan",     title: "Laporan",      scripts: ["/Js/laporan.js", "/Js/script.js"] },
    pengaturan:  { file: "/Pages/pengaturan",  title: "Pengaturan",   scripts: ["/Js/pengaturan.js", "/Js/script.js"] }
  };

  const view = document.getElementById("pageView");
  const crumb = document.querySelector(".crumb");
  let currentLoad = 0;
  let currentProfile = null;

  const hasPage = (key) => Object.prototype.hasOwnProperty.call(PAGES, key);

  function keyFromUrl() {
    const key = new URLSearchParams(window.location.search).get("page");
    return hasPage(key) ? key : DEFAULT_PAGE;
  }

  function toastShell(teks, galat) {
    let kotak = document.getElementById("admin-toast");
    if (!kotak) {
      kotak = document.createElement("div");
      kotak.id = "admin-toast";
      kotak.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:9999;padding:12px 18px;" +
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

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "AD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatTanggal(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || ""));
    return m ? m[3] + " " + BULAN[Number(m[2]) - 1] + " " + m[1] : "-";
  }

  function renderTopbarProfile(profile) {
    if (!profile) return;
    currentProfile = profile;
    const avatar = document.getElementById("topbarAvatar");
    const nameEl = document.getElementById("topbarName");
    const roleEl = document.getElementById("topbarRole");
    if (avatar) avatar.textContent = getInitials(profile.name);
    if (nameEl) nameEl.textContent = profile.name || "Admin";
    if (roleEl) roleEl.textContent = profile.role === "admin" ? "Admin" : "Anggota";
  }

  async function syncProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.status === 401) {
        window.location.href = "/index";
        return null;
      }
      const data = await res.json().catch(function () { return {}; });
      if (res.ok && data.profile) {
        renderTopbarProfile(data.profile);
        return data.profile;
      }
    } catch (e) {
      console.warn("Gagal memuat profil:", e);
    }
    return null;
  }

// ---------------- Modal Profil Admin ----------------
  const profileBtn = document.getElementById("openAdminProfile");
  const profileModal = document.getElementById("adminProfileModal");
  const profileForm = document.getElementById("adminProfileForm");

  function toggleSandiModal(tampil) {
    ["sandiLama", "sandiBaru", "sandiKonfirmasi"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.type = tampil ? "text" : "password";
    });
  }

  function openProfileModal() {
    if (!profileModal) return;
    const p = currentProfile;
    if (p) {
      const setVal = function (id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
      };
      setVal("nama", p.name);
      setVal("npm", p.npm);
      setVal("email", p.email);
      setVal("telepon", p.phone);
      if (p.program_study) setVal("prodi", p.program_study); // <-- Ubah baris ini (sebelumnya p.prodi)
    }

    ["sandiLama", "sandiBaru", "sandiKonfirmasi"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const showPwCheck = document.getElementById("showPassword");
    if (showPwCheck) showPwCheck.checked = false;
    toggleSandiModal(false);

    profileModal.classList.add("show");
  }

  function closeProfileModal() {
    if (profileModal) profileModal.classList.remove("show");
  }

  if (profileBtn) {
    profileBtn.addEventListener("click", async function () {
      if (!currentProfile) await syncProfile();
      openProfileModal();
    });
    profileBtn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        profileBtn.click();
      }
    });
  }

  if (profileModal) {
    profileModal.querySelectorAll("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", closeProfileModal);
    });
    profileModal.addEventListener("click", function (e) {
      if (e.target === profileModal) closeProfileModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && profileModal.classList.contains("show")) {
        closeProfileModal();
      }
    });
  }

  // Hanya angka di kolom Nomor Telepon
  const teleponInput = document.getElementById("telepon");
  if (teleponInput) {
    teleponInput.addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  }

  // Checkbox tampilkan/sembunyikan kata sandi
  const showPasswordCheck = document.getElementById("showPassword");
  if (showPasswordCheck) {
    showPasswordCheck.addEventListener("change", function () {
      toggleSandiModal(showPasswordCheck.checked);
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const curPw = document.getElementById("sandiLama").value;
      const newPw = document.getElementById("sandiBaru").value;
      const confPw = document.getElementById("sandiKonfirmasi").value;
      const inginUbahPw = Boolean(curPw || newPw || confPw);

      if (inginUbahPw) {
        if (!curPw) {
          toastShell("Masukkan kata sandi saat ini terlebih dahulu.", true);
          return;
        }
        if (newPw.length < 8) {
          toastShell("Kata sandi baru minimal 8 karakter.", true);
          return;
        }
        if (newPw !== confPw) {
          toastShell("Konfirmasi kata sandi baru tidak cocok.", true);
          return;
        }
      }

      const submitBtn = profileForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        // 1. Simpan perubahan data profil umum
        const resProf = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          name: document.getElementById("nama").value,
          npm: document.getElementById("npm").value,
          email: document.getElementById("email").value,
          phone: document.getElementById("telepon").value,
          program_study: document.getElementById("prodi").value
          })
        });
        const dataProf = await resProf.json().catch(function () { return {}; });
        if (!resProf.ok) {
          toastShell(dataProf.message || "Gagal memperbarui profil.", true);
          return;
        }
        if (dataProf.profile) {
          renderTopbarProfile(dataProf.profile);
        }

        // 2. Jika kolom password diisi, simpan perubahan kata sandi
        if (inginUbahPw) {
          const resPw = await fetch("/api/profile/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              current_password: curPw,
              new_password: newPw
            })
          });
          const dataPw = await resPw.json().catch(function () { return {}; });
          if (!resPw.ok) {
            toastShell(dataPw.message || "Profil disimpan, tetapi kata sandi gagal diubah.", true);
            return;
          }
        }

        closeProfileModal();
        toastShell(inginUbahPw ? "Profil dan kata sandi berhasil diperbarui." : "Profil berhasil diperbarui.");
      } catch (err) {
        toastShell("Tidak bisa terhubung ke server.", true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ---------------- Navigasi Halaman SPA ----------------
  function showNotice(text) {
    const p = document.createElement("p");
    p.className = "meta";
    p.textContent = text;
    view.replaceChildren(p);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = src + "?v=" + Date.now();
      script.dataset.pageScript = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function loadPage(key) {
    const page = PAGES[key];
    const myLoad = ++currentLoad;

    document.querySelectorAll(".menu a[data-page]").forEach(function (a) {
      a.classList.toggle("active", a.dataset.page === key);
    });
    if (crumb) crumb.textContent = "Workspace / " + page.title;
    document.title = BRAND + " - " + page.title;
    document.querySelectorAll("script[data-page-script]").forEach(function (s) { s.remove(); });
    showNotice("Memuat...");

    try {
      const response = await fetch(page.file, {
        credentials: 'same-origin'
      });
      if (myLoad !== currentLoad) return;
      if (response.redirected) { window.location.href = "/Pages/index"; return; }
      if (response.status === 404) return showNotice("Halaman ini belum tersedia.");
      if (response.status === 403) return showNotice("Anda tidak punya akses ke halaman ini.");
      if (!response.ok) return showNotice("Tidak bisa memuat halaman.");

      const html = await response.text();
      if (myLoad !== currentLoad) return;
      view.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();
      window.scrollTo(0, 0);

      for (const src of page.scripts || []) {
        if (myLoad !== currentLoad) return;
        try {
          await loadScript(src);
        } catch (err) {
          console.warn("Script gagal dimuat:", src);
        }
      }
    } catch (error) {
      if (myLoad === currentLoad) showNotice("Tidak bisa terhubung ke server.");
    }
  }

  // Klik menu: ganti isi dan alamat tanpa reload
  document.addEventListener("click", function (e) {
    const link = e.target.closest("a[data-page]");
    if (!link || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const key = link.dataset.page;
    if (!hasPage(key)) return;
    e.preventDefault();
    if (key !== keyFromUrl()) {
      history.pushState({}, "", "?page=" + key);
      loadPage(key);
    }
  });

  window.addEventListener("popstate", function () { loadPage(keyFromUrl()); });

  const logout = document.getElementById("btnLogout");
  if (logout) {
    logout.addEventListener("click", async function (e) {
      e.preventDefault();
      try { await fetch("/api/auth/logout", { method: "POST" }); } catch (error) {}
      window.location.href = "/index";
    });
  }

  // Sinkronkan profil topbar dan muat halaman awal
  syncProfile();
  const first = keyFromUrl();
  if (new URLSearchParams(window.location.search).get("page") !== first) {
    history.replaceState({}, "", "?page=" + first);
  }
  loadPage(first);
})();
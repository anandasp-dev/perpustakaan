// PENGATURAN — halaman admin, tersambung ke database lewat /api/profile
if (window.lucide) lucide.createIcons();

(function () {
  "use strict";

  const BULAN_PENUH = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  function dua(n) { return String(n).padStart(2, "0"); }
  function isi(id, teks) {
    const el = document.getElementById(id);
    if (el) el.textContent = teks;
  }

  function formatWaktuDb(teks) {
    if (!teks) return "-";
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(teks));
    if (!m) return String(teks);
    const tgl = Number(m[3]) + " " + BULAN_PENUH[Number(m[2]) - 1] + " " + m[1];
    return m[4] && m[5] ? tgl + ", " + dua(m[4]) + ":" + dua(m[5]) + " WIB" : tgl;
  }

  function renderProfil(p) {
    if (!p) return;
    isi("dispName", p.name || "-");
    isi("dispNpm", p.npm || "-");
    isi("dispEmail", p.email || "-");
    isi("dispPhone", p.phone || "-");
    isi("dispRole", p.role === "admin" ? "Admin" : "Anggota");
    isi("dispProdi", p.program_study || p.prodi || "-");

    const aktif = String(p.status || "active").toLowerCase() === "active";
    isi("dispStatus", aktif ? "Aktif" : "Ditangguhkan");
    const dot = document.getElementById("dispStatusDot");
    if (dot) dot.style.background = aktif ? "" : "#dc2626";

    isi("dispLastLogin", formatWaktuDb(p.last_login || p.created_at));
  }

  async function muatProfil() {
    try {
      const respons = await fetch("/api/profile", { credentials: "same-origin" });
      if (respons.status === 401) {
        window.location.href = "/index";
        return;
      }
      const data = await respons.json().catch(function () { return {}; });
      if (respons.ok && data.profile) {
        renderProfil(data.profile);
      }
    } catch (galat) {
      console.warn("Gagal memuat data profil:", galat);
    }
  }

  // Tombol "Edit Profil" membuka modal profil yang sudah ada di admin.html
  const btnEdit = document.getElementById("editProfile");
  if (btnEdit) {
    btnEdit.addEventListener("click", function () {
      const topbarBtn = document.getElementById("openAdminProfile");
      if (topbarBtn) topbarBtn.click();
    });
  }

  // Segarkan tampilan halaman pengaturan setiap kali modal profil di admin.html ditutup
  const profileModal = document.getElementById("adminProfileModal");
  if (profileModal) {
    if (window._pengaturanModalObserver) {
      window._pengaturanModalObserver.disconnect();
    }
    let sebelumnyaTerbuka = profileModal.classList.contains("show");
    window._pengaturanModalObserver = new MutationObserver(function () {
      const terbukaSekarang = profileModal.classList.contains("show");
      if (sebelumnyaTerbuka && !terbukaSekarang) {
        muatProfil();
      }
      sebelumnyaTerbuka = terbukaSekarang;
    });
    window._pengaturanModalObserver.observe(profileModal, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  muatProfil();
})();
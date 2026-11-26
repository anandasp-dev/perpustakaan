// PENGATURAN — halaman admin, tersambung ke database lewat /api/profile
lucide.createIcons();

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

  function toast(teks, galat) {
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

  async function panggil(url, opsi) {
    const respons = await fetch(url, opsi);
    const data = await respons.json().catch(function () { return {}; });
    if (respons.status === 401) {
      window.location.href = "/index";
      throw new Error("Sesi berakhir, silakan login lagi");
    }
    if (!respons.ok) {
      const galat = new Error(data.message || "Permintaan gagal");
      galat.status = respons.status;
      throw galat;
    }
    return data;
  }

  function kirimJson(data) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  }

  const modal = document.getElementById("profileModal");
  const form = document.getElementById("profileForm");
  const inputNama = document.getElementById("nama");
  const inputEmail = document.getElementById("email");
  const inputTelepon = document.getElementById("telepon");
  const sandiLama = document.getElementById("sandiLama");
  const sandiBaru = document.getElementById("sandiBaru");
  const sandiKonfirmasi = document.getElementById("sandiKonfirmasi");
  const centang = document.getElementById("showPassword");

  let profilSaatIni = null;

  function renderProfil(p) {
    profilSaatIni = p;
    isi("dispName", p.name || "-");
    isi("dispCode", p.code || "-");
    isi("dispEmail", p.email || "-");
    isi("dispPhone", p.phone || "-");
    isi("dispRole", p.role === "admin" ? "Admin" : "Anggota");

    const aktif = String(p.status || "active").toLowerCase() === "active";
    isi("dispStatus", aktif ? "Aktif" : "Ditangguhkan");
    const dot = document.getElementById("dispStatusDot");
    if (dot) dot.style.background = aktif ? "" : "#dc2626";

    isi("dispCreated", formatWaktuDb(p.created_at));
    isi("dispLastLogin", formatWaktuDb(p.last_login || p.created_at));
    isi("profileSub", "Perbarui informasi pribadi Anda. ID Admin (" + (p.code || "ADM") + ") tetap.");

    const topName = document.querySelector(".user-name, .profile-name");
    if (topName && p.name) topName.textContent = p.name;
  }

  async function muatProfil() {
    try {
      const data = await panggil("/api/profile");
      if (data.profile) renderProfil(data.profile);
    } catch (galat) {
      toast(galat.message || "Gagal memuat data profil dari server.", true);
    }
  }

  function tampilkanSandi(tampil) {
    [sandiLama, sandiBaru, sandiKonfirmasi].forEach(function (input) {
      if (input) input.type = tampil ? "text" : "password";
    });
  }

  function bukaModal() {
    if (profilSaatIni) {
      inputNama.value = profilSaatIni.name || "";
      inputEmail.value = profilSaatIni.email || "";
      inputTelepon.value = profilSaatIni.phone || "";
    }
    sandiLama.value = "";
    sandiBaru.value = "";
    sandiKonfirmasi.value = "";
    if (centang) centang.checked = false;
    tampilkanSandi(false);
    modal.classList.add("show");
  }

  function tutupModal() {
    modal.classList.remove("show");
    if (centang) centang.checked = false;
    tampilkanSandi(false);
  }

  document.getElementById("editProfile").addEventListener("click", bukaModal);

  modal.querySelectorAll("[data-close]").forEach(function (tombol) {
    tombol.addEventListener("click", tutupModal);
  });

  modal.addEventListener("click", function (e) {
    if (e.target === modal) tutupModal();
  });

  if (window._pengaturanEscKey) {
    document.removeEventListener("keydown", window._pengaturanEscKey);
  }
  window._pengaturanEscKey = function (e) {
    if (e.key === "Escape") tutupModal();
  };
  document.addEventListener("keydown", window._pengaturanEscKey);

  if (centang) {
    centang.addEventListener("change", function () {
      tampilkanSandi(centang.checked);
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const pwLama = sandiLama.value;
    const pwBaru = sandiBaru.value;
    const pwKonf = sandiKonfirmasi.value;
    const inginUbahSandi = Boolean(pwLama || pwBaru || pwKonf);

    if (inginUbahSandi) {
      if (!pwLama) {
        toast("Masukkan kata sandi saat ini untuk mengubah kata sandi.", true);
        sandiLama.focus();
        return;
      }
      if (pwBaru.length < 8) {
        toast("Kata sandi baru minimal 8 karakter.", true);
        sandiBaru.focus();
        return;
      }
      if (pwBaru !== pwKonf) {
        toast("Konfirmasi kata sandi baru tidak cocok.", true);
        sandiKonfirmasi.focus();
        return;
      }
    }

    const tombol = form.querySelector('button[type="submit"]');
    tombol.disabled = true;

    try {
      const resProfil = await panggil("/api/profile", kirimJson({
        name: inputNama.value,
        email: inputEmail.value,
        phone: inputTelepon.value
      }));

      if (inginUbahSandi) {
        await panggil("/api/profile/password", kirimJson({
          current_password: pwLama,
          new_password: pwBaru
        }));
      }

      if (resProfil.profile) renderProfil(resProfil.profile);
      tutupModal();
      toast(inginUbahSandi
        ? "Profil dan kata sandi berhasil diperbarui."
        : "Profil berhasil diperbarui.");
    } catch (galat) {
      toast(galat.message || "Gagal menyimpan perubahan.", true);
    } finally {
      tombol.disabled = false;
    }
  });

  muatProfil();
})();
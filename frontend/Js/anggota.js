//ANGGOTA — halaman admin, tersambung ke database lewat /api/admin/members
if (window.lucide) lucide.createIcons();

(function () {
  "use strict";

  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const URUTAN = { recent: "aktivitas terbaru", name: "nama A-Z", borrowed: "paling banyak pinjam" };
  const NPM_RE = /^[0-9]{12}$/;
  const PHONE_RE = /^08[0-9]{8,11}$/;

  const DAFTAR_PRODI = [
    "Bimbingan dan Konseling (S1)",
    "Pendidikan Ekonomi (S1)",
    "Pendidikan Sejarah (S1)",
    "Bisnis Digital (S1)",
    "Manajemen Ritel (S1)",
    "Pendidikan Matematika (S1)",
    "Biologi (S1)",
    "Fisika (S1)",
    "Teknik Informatika (S1)",
    "Sistem Informasi (S1)",
    "Teknik Industri (S1)",
    "Arsitektur (S1)",
    "Pendidikan Bahasa Indonesia (S1)",
    "Pendidikan Bahasa Inggris (S1)",
    "Desain Komunikasi Visual (S1)",
    "Program Magister (S2)",
    "Program Doktor (S3)"
  ];

  // ---------------- alat bantu kecil ----------------
  function angka(n) { return Number(n || 0).toLocaleString("id-ID"); }
  function isi(el, teks) { if (el) el.textContent = teks; }

  function esc(teks) {
    return String(teks ?? "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function tgl(teks) {                      // "2026-11-22" -> "22 Nov 2026"
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || ""));
    return m ? m[3] + " " + BULAN[Number(m[2]) - 1] + " " + m[1] : "";
  }

  function keNomorWa(hp) {
    const digit = String(hp || "").replace(/\D/g, "");
    if (!digit) return "";
    if (digit.startsWith("0")) return "62" + digit.slice(1);
    if (digit.startsWith("62")) return digit;
    return "62" + digit;
  }

  function buatLinkWa(pinjaman) {
    const wa = keNomorWa(pinjaman.borrower && pinjaman.borrower.phone);
    if (!wa) return "";
    const pesan =
      "Halo " + pinjaman.borrower.name + ",\n" +
      "Kami dari *Perpustakaan Keyto* ingin mengingatkan bahwa peminjaman buku:\n" +
      "- Judul: *" + pinjaman.title + "* (" + pinjaman.code + ")\n" +
      "- Jatuh tempo: *" + tgl(pinjaman.due_date) + "*\n\n" +
      "Sudah melewati batas pengembalian. Mohon segera mengembalikan buku ke perpustakaan agar pembaca lain dapat meminjamnya. Terima kasih!";
    return "https://wa.me/" + wa + "?text=" + encodeURIComponent(pesan);
  }

  function toast(teks, galat) {
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

  async function panggil(url, opsi) {
    const respons = await fetch(url, Object.assign({ credentials: "same-origin" }, opsi || {}));
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
    return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  }

  // ---------------- elemen halaman ----------------
  const badan = document.getElementById("memberBody");
  const formCari = document.querySelector(".toolbar");
  const inputCari = document.getElementById("searchInput");
  const pilihStatus = document.getElementById("statusFilter");
  const pilihUrut = document.getElementById("sortFilter");
  const pager = document.querySelector(".table-foot .pager");
  const tombolSebelum = pager.querySelectorAll("button")[0];
  const tombolBerikut = pager.querySelectorAll("button")[1];
  const pilPager = pager.querySelector(".pill");

  pilihStatus.removeAttribute("onchange");

  const state = { q: "", status: "all", sort: "recent", page: 1 };
  let daftar = [];
  let daftarTerlambat = [];
  let timerCari = null;

  // ---------------- alamat (?q=...&status=...&sort=...&hal=...) ----------------
  function setKontrol() {
    inputCari.value = state.q;
    pilihStatus.value = state.status;
    pilihUrut.value = state.sort;
    if (!pilihStatus.value) { pilihStatus.value = "all"; state.status = "all"; }
    if (!pilihUrut.value) { pilihUrut.value = "recent"; state.sort = "recent"; }
  }

  function bacaUrl() {
    const p = new URLSearchParams(window.location.search);
    state.q = p.get("q") || "";
    state.status = p.get("status") || "all";
    state.sort = p.get("sort") || "recent";
    const hal = Number(p.get("hal"));
    state.page = hal > 0 ? hal : 1;
    setKontrol();
  }

  function simpanUrl() {
    const p = new URLSearchParams(window.location.search);
    ["q", "status", "sort", "hal"].forEach(function (k) { p.delete(k); });
    if (state.q) p.set("q", state.q);
    if (state.status !== "all") p.set("status", state.status);
    if (state.sort !== "recent") p.set("sort", state.sort);
    if (state.page > 1) p.set("hal", String(state.page));
    const qs = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }

  // ---------------- menggambar tabel ----------------
  function badgeStatus(status) {
    if (status === "suspended") {
      return '<span class="status status-suspended">Tidak Aktif</span>';
    }
    return '<span class="status status-active">Aktif</span>';
  }

  function barisHtml(m) {
    return '<tr data-id="' + m.id + '">' +
      '<td class="muted">' + esc(m.code) + "</td>" +
      '<td><div class="person"><span class="av-lg">' + esc(m.initials) + "</span><b>" + esc(m.name) + "</b></div></td>" +
      '<td class="muted">' + esc(m.email) + "</td>" +
      "<td>" + m.loans_total + "</td>" +
      "<td>" + m.visits_total + "</td>" +
      "<td>" + (m.last_visit ? tgl(m.last_visit) : "&mdash;") + "</td>" +
      "<td>" + badgeStatus(m.status) + "</td>" +
      '<td><div class="actions">' +
      '<button type="button" class="icon-act icon-edit" data-aksi="edit" aria-label="Ubah"><i data-lucide="pencil"></i></button>' +
      '<button type="button" class="icon-act icon-delete" data-aksi="delete" aria-label="Hapus"><i data-lucide="trash-2"></i></button>' +
      "</div></td></tr>";
  }

  function nonaktifkanTombol(tombol, mati) {
    tombol.disabled = mati;
    tombol.style.opacity = mati ? "0.5" : "";
    tombol.style.cursor = mati ? "not-allowed" : "";
  }

  function cariKartu(judul) {
    return Array.from(document.querySelectorAll(".stat")).find(function (k) {
      const s = k.querySelector(".stat-top span");
      return s && s.textContent.trim() === judul;
    });
  }

  function isiKartu(r) {
    const terdaftar = cariKartu("Anggota terdaftar");
    if (terdaftar) isi(terdaftar.querySelector(".stat-number"), angka(r.total));
    const aktif = cariKartu("Anggota aktif");
    if (aktif) {
      isi(aktif.querySelector(".stat-number"), angka(r.total - r.suspended));
      isi(aktif.querySelector(".stat-note"), "+" + r.new_month + " bulan ini");
    }
    const tangguh = cariKartu("Ditangguhkan");
    if (tangguh) isi(tangguh.querySelector(".stat-number"), angka(r.suspended));
  }

  function gambarTabel(data) {
    const rows = data.members;
    badan.innerHTML = rows.length === 0
      ? '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px;">Tidak ada anggota yang cocok.</td></tr>'
      : rows.map(barisHtml).join("");
    if (window.lucide) lucide.createIcons();

    const awal = rows.length ? (data.page - 1) * data.per_page + 1 : 0;
    const akhir = rows.length ? awal + rows.length - 1 : 0;
    const sekarang = new Date();
    isi(document.querySelector(".section-sub"),
      "Total pinjaman dan aktivitas login/kunjungan sampai " + tgl(sekarang.getFullYear() + "-" +
        String(sekarang.getMonth() + 1).padStart(2, "0") + "-" + String(sekarang.getDate()).padStart(2, "0")) +
      " \u2022 Diurutkan berdasarkan " + URUTAN[state.sort]);
    isi(document.querySelector(".table-foot > .muted"),
      "Menampilkan " + awal + "-" + akhir + " dari " + angka(data.total) + " anggota \u2022 " +
      data.per_page + " anggota per halaman");
    isi(pilPager, data.page + " / " + data.pages);
    nonaktifkanTombol(tombolSebelum, data.page <= 1);
    nonaktifkanTombol(tombolBerikut, data.page >= data.pages);
  }

  // ---------------- mengambil data ----------------
  async function muatTerlambat() {
    try {
      const data = await panggil("/api/admin/loans?status=overdue&page=1");
      daftarTerlambat = data.loans || [];
      const jumlah = data.total || 0;
      isi(document.getElementById("overdueMeta"),
        jumlah > 0
          ? jumlah + " pinjaman terlambat perlu ditangani hari ini."
          : "Tidak ada pinjaman terlambat hari ini.");
    } catch (e) {
      isi(document.getElementById("overdueMeta"), "Tidak dapat memuat status pinjaman terlambat.");
    }
  }

  async function muat() {
    const params = new URLSearchParams({ status: state.status, sort: state.sort, page: String(state.page) });
    if (state.q) params.set("q", state.q);
    try {
      const data = await panggil("/api/admin/members?" + params.toString());
      if (data.page > data.pages) {
        state.page = data.pages;
        simpanUrl();
        return muat();
      }
      daftar = data.members;
      gambarTabel(data);
      isiKartu(data.summary);
    } catch (galat) {
      if (galat.status === 403) { window.location.href = "/Pages/dashboard"; return; }
      console.warn("Gagal memuat anggota:", galat);
      toast("Gagal memuat data anggota dari server.", true);
    }
  }

  // ---------------- cari, urutan, halaman ----------------
  function terapkanFilter() {
    state.q = inputCari.value.trim();
    state.status = pilihStatus.value;
    state.sort = pilihUrut.value;
    state.page = 1;
    simpanUrl();
    muat();
  }
  formCari.addEventListener("submit", function (e) { e.preventDefault(); terapkanFilter(); });
  inputCari.addEventListener("input", function () {
    clearTimeout(timerCari);
    timerCari = setTimeout(terapkanFilter, 300);
  });
  pilihStatus.addEventListener("change", terapkanFilter);
  pilihUrut.addEventListener("change", terapkanFilter);

  tombolSebelum.addEventListener("click", function () {
    if (state.page > 1) { state.page--; simpanUrl(); muat(); }
  });
  tombolBerikut.addEventListener("click", function () {
    if (!tombolBerikut.disabled) { state.page++; simpanUrl(); muat(); }
  });

  // ---------------- jendela (modal) ----------------
  const modalTambah = document.getElementById("memberModal");
  const modalUbah = document.getElementById("editModal");
  const modalHapus = document.getElementById("deleteModal");
  const formTambah = modalTambah.querySelector("form");
  const formUbah = document.getElementById("editForm");
  const formHapus = document.getElementById("deleteForm");

  let modalWa = document.getElementById("overdueWaModal");
  if (!modalWa) {
    modalWa = document.createElement("div");
    modalWa.className = "modal-overlay";
    modalWa.id = "overdueWaModal";
    modalWa.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="waModalTitle" style="max-width:640px;">' +
      '<div class="modal-head">' +
      '<div class="modal-icon" style="background:#dcfce7;color:#15803d;"><i data-lucide="message-circle"></i></div>' +
      '<div class="modal-title">' +
      '<h2 id="waModalTitle">Pengingat Peminjaman Terlambat</h2>' +
      '<p id="waModalSub">Kirim pesan pengingat pengembalian langsung ke WhatsApp peminjam.</p>' +
      '</div>' +
      '<button type="button" class="modal-close" data-close aria-label="Tutup"><i data-lucide="x"></i></button>' +
      '</div>' +
      '<div class="modal-body" id="waModalBody" style="max-height:60vh;overflow-y:auto;"></div>' +
      '<div class="modal-foot">' +
      '<button type="button" class="btn-outline" data-close>Tutup</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modalWa);
    if (window.lucide) lucide.createIcons();
  }

  function buka(modal) { modal.classList.add("show"); }
  function tutup(modal) { modal.classList.remove("show"); }

  [modalTambah, modalUbah, modalHapus, modalWa].forEach(function (modal) {
    modal.querySelectorAll("[data-close], #closeModal, #cancelModal").forEach(function (t) {
      t.addEventListener("click", function () { tutup(modal); });
    });
    modal.addEventListener("click", function (e) { if (e.target === modal) tutup(modal); });
  });

  if (window._anggotaEscKey) {
    document.removeEventListener("keydown", window._anggotaEscKey);
  }
  window._anggotaEscKey = function (e) {
    if (e.key !== "Escape") return;
    [modalTambah, modalUbah, modalHapus, modalWa].forEach(function (m) {
      if (document.body.contains(m)) tutup(m);
    });
  };
  document.addEventListener("keydown", window._anggotaEscKey);

  // tombol "Tinjau peminjaman terlambat" -> buka daftar kirim WhatsApp
  const btnOverdue = document.getElementById("btnReviewOverdue");
  if (btnOverdue) {
    btnOverdue.addEventListener("click", async function (e) {
      e.preventDefault();
      await muatTerlambat();
      const isiModal = document.getElementById("waModalBody");
      if (daftarTerlambat.length === 0) {
        isiModal.innerHTML = '<p class="muted" style="text-align:center;padding:24px 0;">Tidak ada peminjaman yang terlambat saat ini.</p>';
      } else {
        isiModal.innerHTML = daftarTerlambat.map(function (p) {
          const hp = p.borrower && p.borrower.phone ? p.borrower.phone : "";
          const link = buatLinkWa(p);
          const tombolWa = link
            ? '<a href="' + link + '" target="_blank" rel="noopener noreferrer" class="btn-primary" ' +
            'style="background:#16a34a;border-color:#16a34a;text-decoration:none;white-space:nowrap;padding:8px 14px;font-size:13px;">' +
            '<i data-lucide="send"></i> Kirim WhatsApp</a>'
            : '<span class="muted" style="font-size:12px;">Nomor HP belum diisi</span>';

          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e2e8f0;">' +
            '<div>' +
            '<div style="font-weight:600;color:#0f172a;">' + esc(p.borrower.name) +
            ' <span class="muted" style="font-weight:400;font-size:12px;">(' + esc(p.borrower.member_id) + (hp ? ' &bull; ' + esc(hp) : '') + ')</span></div>' +
            '<div style="font-size:13px;color:#334155;margin-top:2px;">Buku: <b>' + esc(p.title) + '</b> (' + esc(p.code) + ')</div>' +
            '<div style="font-size:12px;color:#dc2626;margin-top:2px;">Jatuh tempo: ' + esc(tgl(p.due_date)) + '</div>' +
            '</div>' +
            tombolWa +
            '</div>';
        }).join("");
        if (window.lucide) lucide.createIcons();
      }
      buka(modalWa);
    });
  }

  // tombol mata di kolom kata sandi
  document.querySelectorAll(".toggle-pw").forEach(function (tombol) {
    tombol.addEventListener("click", function () {
      const input = tombol.closest(".pw").querySelector("input");
      const tampil = input.type === "password";
      input.type = tampil ? "text" : "password";
      tombol.innerHTML = '<i data-lucide="' + (tampil ? "eye" : "eye-off") + '"></i>';
      if (window.lucide) lucide.createIcons();
    });
  });

  // kolom NPM, Nomor HP, dan Program Studi ditambahkan lewat JS
  function buatBarisNpmHp(kunci, npmHanyaBaca) {
    const baris = document.createElement("div");
    baris.className = "field-row";
    baris.innerHTML =
      '<div class="field"><label for="' + kunci + 'Npm">NPM</label>' +
      '<input type="text" id="' + kunci + 'Npm" inputmode="numeric" maxlength="12" ' +
      (npmHanyaBaca ? 'readonly class="readonly"' : 'placeholder="12 digit angka" required') + "></div>" +
      '<div class="field"><label for="' + kunci + 'Hp">Nomor HP (opsional)</label>' +
      '<input type="tel" id="' + kunci + 'Hp" inputmode="numeric" maxlength="13" placeholder="08xxxxxxxxxx"></div>';
    return baris;
  }

  function buatFieldProdi(kunci, wajib) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const opsi = ['<option value="" disabled selected>Pilih program studi</option>']
      .concat(DAFTAR_PRODI.map(function (p) {
        return '<option value="' + esc(p) + '">' + esc(p) + "</option>";
      }))
      .join("");
    wrap.innerHTML =
      '<label for="' + kunci + 'Prodi">Program studi' + (wajib ? " *" : "") + "</label>" +
      '<select id="' + kunci + 'Prodi" name="program_study"' + (wajib ? " required" : "") + ">" +
      opsi +
      "</select>";
    return wrap;
  }

  const barisTambahNpmHp = buatBarisNpmHp("n", false);
  document.getElementById("password").closest(".field-row").before(barisTambahNpmHp);
  if (!document.getElementById("nProdi")) {
    barisTambahNpmHp.after(buatFieldProdi("n", true));
  }

  const barisUbahNpmHp = buatBarisNpmHp("e", true);
  document.getElementById("editEmail").closest(".field").after(barisUbahNpmHp);
  if (!document.getElementById("eProdi")) {
    barisUbahNpmHp.after(buatFieldProdi("e", false));
  }

  ["nNpm", "nHp", "eHp"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  });

  // ---------------- tambah anggota ----------------
  document.getElementById("openModal").addEventListener("click", function () {
    formTambah.reset();
    ["password", "password2"].forEach(function (id) { document.getElementById(id).type = "password"; });
    const statusTambah = document.getElementById("statusAnggota");
    statusTambah.value = "active";
    statusTambah.disabled = false;
    document.getElementById("totalPinjam").closest(".field-row").style.display = "none";
    document.getElementById("kunjunganTerakhir").closest(".field").style.display = "none";
    buka(modalTambah);
  });

  formTambah.addEventListener("submit", async function (e) {
    e.preventDefault();
    const nama = document.getElementById("nama").value.trim();
    const npm = document.getElementById("nNpm").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("nHp").value.trim();
    const prodi = (document.getElementById("nProdi") || {}).value || "";
    const password = document.getElementById("password").value;
    const password2 = document.getElementById("password2").value;

    if (nama.length < 3) {
      toast("Nama lengkap minimal 3 karakter.", true);
      return;
    }
    if (!NPM_RE.test(npm)) {
      toast("NPM harus 12 digit angka.", true);
      return;
    }
    if (phone && !PHONE_RE.test(phone)) {
      toast("Nomor HP harus diawali 08 dan 10-13 digit angka.", true);
      return;
    }
    if (!prodi) {
      toast("Pilih program studi anggota.", true);
      return;
    }
    if (password.length < 8) {
      toast("Kata sandi minimal 8 karakter.", true);
      return;
    }
    if (password !== password2) {
      toast("Konfirmasi kata sandi tidak cocok.", true);
      return;
    }

    const tombol = formTambah.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      const data = await panggil("/api/admin/members", kirimJson({
        name: nama,
        npm: npm,
        email: email,
        phone: phone,
        program_study: prodi,
        status: document.getElementById("statusAnggota").value,
        password: password
      }));
      tutup(modalTambah);
      toast(data.member.name + " ditambahkan sebagai " + data.member.code + ".");
      state.q = npm;
      state.status = "all";
      state.page = 1;
      setKontrol();
      simpanUrl();
      await muat();
    } catch (galat) {
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  // ---------------- ubah dan hapus ----------------
  let idDiubah = null;

  badan.addEventListener("click", function (e) {
    const tombol = e.target.closest("button[data-aksi]");
    if (!tombol) return;
    const m = daftar.find(function (x) { return x.id === Number(tombol.closest("tr").dataset.id); });
    if (!m) return;

    if (tombol.dataset.aksi === "edit") {
      idDiubah = m.id;
      document.getElementById("editSub").textContent = m.code + " \u2022 " + m.name;
      document.getElementById("editId").value = m.code;
      document.getElementById("editNama").value = m.name;
      document.getElementById("editEmail").value = m.email;
      document.getElementById("eNpm").value = m.npm || "";
      document.getElementById("eHp").value = m.phone || "";

      const elProdi = document.getElementById("eProdi");
      if (elProdi) {
        const nilaiProdi = m.program_study || "";
        if (nilaiProdi && !Array.from(elProdi.options).some(function (o) { return o.value === nilaiProdi; })) {
          const opt = document.createElement("option");
          opt.value = nilaiProdi;
          opt.textContent = nilaiProdi;
          elProdi.appendChild(opt);
        }
        elProdi.value = nilaiProdi;
      }

      const status = document.getElementById("editStatus");
      status.value = m.status === "suspended" ? "suspended" : "active";
      status.disabled = false;
      [["editPinjam", m.loans_total], ["editKunjungan", m.visits_total]].forEach(function (p) {
        const el = document.getElementById(p[0]);
        el.value = p[1];
        el.readOnly = true;
      });
      const terakhir = document.getElementById("editTerakhir");
      terakhir.value = m.last_visit ? String(m.last_visit).slice(0, 10) : "";
      terakhir.disabled = true;
      buka(modalUbah);
    } else {
      document.getElementById("deleteId").value = m.id;
      document.getElementById("deleteSub").textContent = m.code + " \u2022 " + m.name;
      buka(modalHapus);
    }
  });

  formUbah.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!idDiubah) return;

    const nama = document.getElementById("editNama").value.trim();
    const email = document.getElementById("editEmail").value.trim();
    const phone = document.getElementById("eHp").value.trim();
    const prodi = (document.getElementById("eProdi") || {}).value || "";

    if (nama.length < 3) {
      toast("Nama lengkap minimal 3 karakter.", true);
      return;
    }
    if (phone && !PHONE_RE.test(phone)) {
      toast("Nomor HP harus diawali 08 dan 10-13 digit angka.", true);
      return;
    }

    const tombol = formUbah.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      await panggil("/api/admin/members/" + idDiubah, kirimJson({
        name: nama,
        email: email,
        phone: phone,
        program_study: prodi,
        status: document.getElementById("editStatus").value
      }));
      tutup(modalUbah);
      toast("Data anggota diperbarui.");
      await muat();
    } catch (galat) {
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  formHapus.addEventListener("submit", async function (e) {
    e.preventDefault();
    const id = document.getElementById("deleteId").value;
    const tombol = formHapus.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      await panggil("/api/admin/members/" + id + "/delete", { method: "POST" });
      tutup(modalHapus);
      toast("Anggota dihapus.");
      await muat();
    } catch (galat) {
      tutup(modalHapus);
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  // ---------------- mulai ----------------
  bacaUrl();
  muat();
  muatTerlambat();
})();
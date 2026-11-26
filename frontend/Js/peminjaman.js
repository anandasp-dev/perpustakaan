//PEMINJAMAN — halaman admin, tersambung ke database lewat /api/admin/loans
lucide.createIcons();

(function () {
  "use strict";

  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const BULAN_PENUH = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
                       "Agustus", "September", "Oktober", "November", "Desember"];
  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const STATUS = {
    pending:   { teks: "Tunggu konfirmasi", kelas: "status-pending" },
    borrowed:  { teks: "Dipinjam",          kelas: "status-loan" },
    overdue:   { teks: "Terlambat",         kelas: "status-overdue" },
    returned:  { teks: "Dikembalikan",      kelas: "status-returned" },
    cancelled: { teks: "Dibatalkan",        kelas: "status-cancelled" },
    expired:   { teks: "Hangus",            kelas: "status-expired" }
  };

  // ---------------- alat bantu kecil ----------------
  function dua(n) { return String(n).padStart(2, "0"); }
  function angka(n) { return Number(n).toLocaleString("id-ID"); }
  function isi(el, teks) { if (el) el.textContent = teks; }
  function kodePN(id) { return "PN-" + String(id).padStart(4, "0"); }

  function esc(teks) {
    return String(teks).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function parseTanggal(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || ""));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  function keIso(d) { return d.getFullYear() + "-" + dua(d.getMonth() + 1) + "-" + dua(d.getDate()); }
  function tglPanjang(d) { return dua(d.getDate()) + " " + BULAN[d.getMonth()] + " " + d.getFullYear(); }

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
    const dTempo = parseTanggal(pinjaman.due_date);
    const pesan =
      "Halo " + pinjaman.borrower.name + ",\n" +
      "Kami dari *Perpustakaan Keyto* ingin mengingatkan bahwa peminjaman buku:\n" +
      "- Judul: *" + pinjaman.title + "* (" + pinjaman.code + ")\n" +
      "- Jatuh tempo: *" + (dTempo ? tglPanjang(dTempo) : pinjaman.due_date) + "*\n\n" +
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
    return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  }

  // ---------------- elemen halaman ----------------
  const badan = document.getElementById("loanBody");
  const formCari = document.querySelector(".toolbar");
  const inputCari = formCari.querySelector('input[name="q"]');
  const pilihStatus = formCari.querySelector('select[name="status"]');
  const pilihTanggal = formCari.querySelector('select[name="tanggal"]');
  const pager = document.querySelector(".table-foot .pager");
  const tombolSebelum = pager.querySelectorAll("button")[0];
  const tombolBerikut = pager.querySelectorAll("button")[1];
  const pilPager = pager.querySelector(".pill");

  pilihStatus.insertBefore(new Option("Tunggu konfirmasi", "pending"), pilihStatus.options[1]);
  pilihStatus.appendChild(new Option("Dibatalkan", "cancelled"));
  pilihStatus.appendChild(new Option("Hangus", "expired"));
  pilihStatus.removeAttribute("onchange");
  pilihTanggal.removeAttribute("onchange");

  const state = { q: "", status: "all", tanggal: "all", page: 1 };
  let daftar = [];

  // ---------------- alamat (?q=...&status=...&tanggal=...&hal=...) ----------------
  function bacaUrl() {
    const p = new URLSearchParams(window.location.search);
    state.q = p.get("q") || "";
    state.status = p.get("status") || "all";
    state.tanggal = p.get("tanggal") || "all";
    const hal = Number(p.get("hal"));
    state.page = hal > 0 ? hal : 1;

    inputCari.value = state.q;
    pilihStatus.value = state.status;
    pilihTanggal.value = state.tanggal;
    if (!pilihStatus.value) { pilihStatus.value = "all"; state.status = "all"; }
    if (!pilihTanggal.value) { pilihTanggal.value = "all"; state.tanggal = "all"; }
  }

  function simpanUrl() {
    const p = new URLSearchParams(window.location.search);
    ["q", "status", "tanggal", "hal"].forEach(function (k) { p.delete(k); });
    if (state.q) p.set("q", state.q);
    if (state.status !== "all") p.set("status", state.status);
    if (state.tanggal !== "all") p.set("tanggal", state.tanggal);
    if (state.page > 1) p.set("hal", String(state.page));
    const qs = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }

  // ---------------- menggambar tabel ----------------
  function ikon(kelas, aksi, judul, nama) {
    return '<button type="button" class="icon-act ' + kelas + '" data-aksi="' + aksi + '" title="' +
      judul + '" aria-label="' + judul + '"><i data-lucide="' + nama + '"></i></button>';
  }

  function aksiHtml(p) {
    const tombol = [];
    if (p.status === "pending") {
      tombol.push(ikon("icon-confirm", "confirm", "Konfirmasi peminjaman", "check"));
    }
    if (p.status === "borrowed") {
      tombol.push(ikon("icon-return", "return", "Terima pengembalian", "book-check"));
      tombol.push(ikon("icon-edit", "edit", "Ubah jatuh tempo", "pencil"));
    }
    if (tombol.length === 0) return '<td class="dash">&mdash;</td>';
    return '<td><div class="row-actions">' + tombol.join("") + "</div></td>";
  }

  function sel(teks) {
    return teks ? "<td>" + teks + "</td>" : '<td class="dash">&mdash;</td>';
  }

  function barisHtml(p) {
    const st = STATUS[p.display_status] || { teks: p.display_status, kelas: "" };
    const pinjam = parseTanggal(p.confirmed_at || p.borrowed_at);
    const tempo = parseTanggal(p.due_date);
    const kembali = parseTanggal(p.returned_at);
    return '<tr data-id="' + p.id + '">' +
      '<td class="muted">' + esc(p.code) + "</td>" +
      '<td><div class="person"><span class="av-lg">' + esc(p.borrower.initials) + "</span><b>" +
        esc(p.borrower.name) + "</b></div></td>" +
      "<td>" + esc(p.title) + "</td>" +
      sel(pinjam ? tglPanjang(pinjam) : "") +
      sel(tempo ? tglPanjang(tempo) : "") +
      sel(kembali ? tglPanjang(kembali) : "") +
      '<td><span class="status ' + st.kelas + '">' + st.teks + "</span></td>" +
      aksiHtml(p) +
      "</tr>";
  }

  function nonaktifkanTombol(tombol, mati) {
    tombol.disabled = mati;
    tombol.style.opacity = mati ? "0.5" : "";
    tombol.style.cursor = mati ? "not-allowed" : "";
  }

  function gambarTabel(data) {
    const rows = data.loans;
    badan.innerHTML = rows.length === 0
      ? '<tr><td colspan="8" class="muted">Tidak ada transaksi yang cocok.</td></tr>'
      : rows.map(barisHtml).join("");
    lucide.createIcons();

    const awal = rows.length ? (data.page - 1) * data.per_page + 1 : 0;
    const akhir = rows.length ? awal + rows.length - 1 : 0;
    const sekarang = new Date();
    isi(document.querySelector(".section-sub"),
      "Data per " + sekarang.getDate() + " " + BULAN_PENUH[sekarang.getMonth()] + " " +
      sekarang.getFullYear() + " • diurutkan menurut tanggal pinjam terbaru");
    isi(document.querySelector(".section-row > .muted"), rows.length + " dari " + angka(data.total) + " transaksi");
    isi(document.querySelector(".table-foot > .muted"),
      "Menampilkan " + awal + "-" + akhir + " dari " + angka(data.total) + " transaksi • " +
      data.per_page + " transaksi per halaman");
    isi(pilPager, data.page + " / " + data.pages);
    nonaktifkanTombol(tombolSebelum, data.page <= 1);
    nonaktifkanTombol(tombolBerikut, data.page >= data.pages);
  }

  // ---------------- tiga kartu angka di atas ----------------
  function cariKartu(judul) {
    return Array.from(document.querySelectorAll(".stat")).find(function (k) {
      const s = k.querySelector(".stat-top span");
      return s && s.textContent.trim() === judul;
    });
  }

  function isiKartu(r) {
    const sekarang = new Date();
    const aktif = cariKartu("Peminjaman aktif");
    if (aktif) {
      isi(aktif.querySelector(".stat-number"), angka(r.borrowed));
      isi(aktif.querySelector(".stat-note"),
        "Termasuk " + r.overdue + " pinjaman terlambat" +
        (r.pending > 0 ? " • " + r.pending + " menunggu konfirmasi" : ""));
    }
    const kembali = cariKartu("Dikembalikan hari ini");
    if (kembali) {
      isi(kembali.querySelector(".stat-number"), angka(r.returned_today));
      isi(kembali.querySelector(".stat-note"),
        NAMA_HARI[sekarang.getDay()] + ", " + tglPanjang(sekarang));
    }
    const lambat = cariKartu("Pinjaman terlambat");
    if (lambat) isi(lambat.querySelector(".stat-number"), angka(r.overdue));

    const kartuInfo = Array.from(document.querySelectorAll(".info-cards .card")).find(function (k) {
      const h = k.querySelector("h3");
      return h && h.textContent.indexOf("Pengingat") === 0;
    });
    if (kartuInfo) {
      isi(kartuInfo.querySelector(".meta"),
        r.overdue > 0
          ? r.overdue + " pinjaman terlambat perlu ditangani hari ini."
          : "Tidak ada pinjaman terlambat hari ini.");
    }
  }

  // ---------------- mengambil data ----------------
  async function muat() {
    const params = new URLSearchParams({ status: state.status, period: state.tanggal, page: String(state.page) });
    if (state.q) params.set("q", state.q);
    try {
      const data = await panggil("/api/admin/loans?" + params.toString());
      if (data.page > data.pages) {
        state.page = data.pages;
        simpanUrl();
        return muat();
      }
      daftar = data.loans;
      gambarTabel(data);
      isiKartu(data.summary);
    } catch (galat) {
      if (galat.status === 403) { window.location.href = "/Pages/dashboard"; return; }
      console.warn("Gagal memuat peminjaman:", galat);
      toast("Gagal memuat data peminjaman dari server.", true);
    }
  }

  // ---------------- cari, filter, halaman ----------------
  function terapkanFilter() {
    state.q = inputCari.value.trim();
    state.status = pilihStatus.value;
    state.tanggal = pilihTanggal.value;
    state.page = 1;
    simpanUrl();
    muat();
  }
  formCari.addEventListener("submit", function (e) { e.preventDefault(); terapkanFilter(); });
  pilihStatus.addEventListener("change", terapkanFilter);
  pilihTanggal.addEventListener("change", terapkanFilter);

  tombolSebelum.addEventListener("click", function () {
    if (state.page > 1) { state.page--; simpanUrl(); muat(); }
  });
  tombolBerikut.addEventListener("click", function () {
    if (!tombolBerikut.disabled) { state.page++; simpanUrl(); muat(); }
  });

  // ---------------- tombol aksi di baris tabel ----------------
  async function aksiServer(url, pesanSukses, tombol) {
    if (tombol) tombol.disabled = true;
    try {
      await panggil(url, { method: "POST" });
      toast(pesanSukses);
    } catch (galat) {
      toast(galat.message, true);
    }
    await muat();
  }

  badan.addEventListener("click", function (e) {
    const tombol = e.target.closest("button[data-aksi]");
    if (!tombol) return;
    const p = daftar.find(function (x) { return x.id === Number(tombol.closest("tr").dataset.id); });
    if (!p) return;

    if (tombol.dataset.aksi === "confirm") {
      if (!window.confirm("Konfirmasi " + p.code + "?\n" + p.title + " untuk " + p.borrower.name +
          ".\nMasa pinjam 14 hari dihitung mulai hari ini.")) return;
      aksiServer("/api/loans/" + p.id + "/confirm", p.code + " dikonfirmasi. Silakan serahkan bukunya.", tombol);
    } else if (tombol.dataset.aksi === "return") {
      if (!window.confirm("Terima pengembalian " + p.code + "?\n" + p.title + " dari " + p.borrower.name + ".")) return;
      aksiServer("/api/loans/" + p.id + "/return", p.code + " dikembalikan. Stok buku bertambah.", tombol);
    } else if (tombol.dataset.aksi === "edit") {
      bukaUbah(p);
    }
  });

  // ---------------- dropdown otomatis & validasi peminjam + buku ----------------
  let semuaAnggotaDb = [];
  let anggotaAktifDb = [];
  let sedangMuatAnggota = false;

  let semuaBukuDb = [];
  let bukuTersediaDb = [];
  let sedangMuatBuku = false;

  const modalTambah = document.getElementById("loanModal");
  const formTambah = document.getElementById("loanForm");

  const inputPeminjam = document.getElementById("lPeminjam");
  const inputPeminjamCode = document.getElementById("lPeminjamCode");
  const listDropdownPeminjam = document.getElementById("memberDropdownList");
  const errorPeminjamEl = document.getElementById("lPeminjamError");

  const inputBuku = document.getElementById("lBuku");
  const inputBukuCode = document.getElementById("lBukuCode");
  const listDropdownBuku = document.getElementById("bookDropdownList");
  const errorBukuEl = document.getElementById("lBukuError");

  function setErrorField(inputEl, errEl, pesan) {
    if (!errEl || !inputEl) return;
    if (pesan) {
      errEl.textContent = pesan;
      errEl.style.display = "block";
      inputEl.style.borderColor = "#dc2626";
    } else {
      errEl.textContent = "";
      errEl.style.display = "none";
      inputEl.style.borderColor = "";
    }
  }

  // --- Peminjam (Anggota) ---
  async function muatDaftarAnggota() {
    if (sedangMuatAnggota) return;
    sedangMuatAnggota = true;
    try {
      const pertama = await panggil("/api/admin/members?page=1");
      const gabungan = Array.isArray(pertama.members) ? pertama.members.slice() : [];
      const totalHalaman = Number(pertama.pages || 1);

      for (let hal = 2; hal <= totalHalaman; hal++) {
        const lanjutan = await panggil("/api/admin/members?page=" + hal);
        if (Array.isArray(lanjutan.members)) {
          gabungan.push.apply(gabungan, lanjutan.members);
        }
      }

      semuaAnggotaDb = gabungan;
      anggotaAktifDb = gabungan.filter(function (m) {
        return String(m.status || "active").toLowerCase() === "active";
      });
    } catch (galat) {
      console.warn("Gagal memuat daftar anggota:", galat);
    } finally {
      sedangMuatAnggota = false;
    }
  }

  function tampilkanDropdownPeminjam(kataKunci) {
    if (!listDropdownPeminjam) return;
    const q = String(kataKunci || "").trim().toLowerCase();

    if (sedangMuatAnggota && semuaAnggotaDb.length === 0) {
      listDropdownPeminjam.innerHTML =
        '<div style="padding:10px 12px;font-size:13px;color:#64748b;">Memuat daftar anggota...</div>';
      listDropdownPeminjam.style.display = "block";
      return;
    }

    const hasil = anggotaAktifDb.filter(function (m) {
      const nama = String(m.name || "").toLowerCase();
      const npm = String(m.npm || "").toLowerCase();
      const kode = String(m.code || "").toLowerCase();
      const email = String(m.email || "").toLowerCase();
      return !q || nama.includes(q) || npm.includes(q) || kode.includes(q) || email.includes(q);
    });

    if (hasil.length === 0) {
      listDropdownPeminjam.innerHTML =
        '<div style="padding:10px 12px;font-size:13px;color:#64748b;">Tidak ada anggota aktif yang cocok.</div>';
    } else {
      listDropdownPeminjam.innerHTML = hasil.map(function (m) {
        const label = m.name + (m.npm ? " (" + m.npm + ")" : " (" + m.code + ")");
        return (
          '<div class="member-combo-item" data-code="' + esc(m.code) + '" data-label="' + esc(label) + '" ' +
            'style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;">' +
            '<div>' +
              '<div style="font-weight:600;color:#0f172a;">' + esc(m.name) + '</div>' +
              '<div style="font-size:11px;color:#64748b;">NPM: ' + esc(m.npm || "-") + '</div>' +
            '</div>' +
            '<span style="font-size:11px;font-weight:600;color:#0f766e;background:#f0fdfa;padding:2px 8px;border-radius:999px;white-space:nowrap;">' +
              esc(m.code) +
            '</span>' +
          '</div>'
        );
      }).join("");
    }

    listDropdownPeminjam.style.display = "block";
  }

  function validasiInputPeminjam() {
    const teks = inputPeminjam.value.trim();
    const kodeTerpilih = inputPeminjamCode ? inputPeminjamCode.value.trim() : "";

    if (!teks) {
      setErrorField(inputPeminjam, errorPeminjamEl, "Peminjam wajib diisi dan dipilih dari daftar.");
      return null;
    }

    let cocok = null;
    if (kodeTerpilih) {
      cocok = semuaAnggotaDb.find(function (m) { return m.code === kodeTerpilih; }) || null;
    }

    if (!cocok) {
      const q = teks.toLowerCase();
      const daftarCocok = semuaAnggotaDb.filter(function (m) {
        const label = (m.name + (m.npm ? " (" + m.npm + ")" : " (" + m.code + ")")).toLowerCase();
        return String(m.npm || "").trim().toLowerCase() === q ||
               String(m.code || "").trim().toLowerCase() === q ||
               String(m.name || "").trim().toLowerCase() === q ||
               label === q;
      });

      if (daftarCocok.length === 0) {
        setErrorField(inputPeminjam, errorPeminjamEl, "Anggota tidak ditemukan di database. Silakan pilih dari daftar.");
        return null;
      }
      if (daftarCocok.length > 1) {
        setErrorField(inputPeminjam, errorPeminjamEl, "Ada lebih dari satu anggota yang cocok. Silakan pilih langsung dari daftar.");
        return null;
      }
      cocok = daftarCocok[0];
    }

    if (String(cocok.status || "active").toLowerCase() !== "active") {
      setErrorField(inputPeminjam, errorPeminjamEl, 'Akun anggota "' + cocok.name + '" sedang ditangguhkan / tidak aktif.');
      return null;
    }

    if (inputPeminjamCode) inputPeminjamCode.value = cocok.code;
    setErrorField(inputPeminjam, errorPeminjamEl, "");
    return cocok;
  }

  if (inputPeminjam && listDropdownPeminjam) {
    inputPeminjam.addEventListener("focus", async function () {
      if (listDropdownBuku) listDropdownBuku.style.display = "none";
      if (semuaAnggotaDb.length === 0) await muatDaftarAnggota();
      tampilkanDropdownPeminjam(inputPeminjam.value);
    });

    inputPeminjam.addEventListener("click", function () {
      if (listDropdownBuku) listDropdownBuku.style.display = "none";
      tampilkanDropdownPeminjam(inputPeminjam.value);
    });

    inputPeminjam.addEventListener("input", function () {
      if (inputPeminjamCode) inputPeminjamCode.value = "";
      setErrorField(inputPeminjam, errorPeminjamEl, "");
      tampilkanDropdownPeminjam(inputPeminjam.value);
    });

    listDropdownPeminjam.addEventListener("mousedown", function (e) {
      const item = e.target.closest(".member-combo-item");
      if (!item) return;
      inputPeminjam.value = item.dataset.label;
      if (inputPeminjamCode) inputPeminjamCode.value = item.dataset.code;
      setErrorField(inputPeminjam, errorPeminjamEl, "");
      listDropdownPeminjam.style.display = "none";
    });
  }

  // --- Buku ---
  async function muatDaftarBuku() {
    if (sedangMuatBuku) return;
    sedangMuatBuku = true;
    try {
      const pertama = await panggil("/api/admin/books?page=1");
      const gabungan = Array.isArray(pertama.books) ? pertama.books.slice() : [];
      const totalHalaman = Number(pertama.pages || 1);

      for (let hal = 2; hal <= totalHalaman; hal++) {
        const lanjutan = await panggil("/api/admin/books?page=" + hal);
        if (Array.isArray(lanjutan.books)) {
          gabungan.push.apply(gabungan, lanjutan.books);
        }
      }

      semuaBukuDb = gabungan;
      bukuTersediaDb = gabungan.filter(function (b) {
        return Number(b.available || 0) > 0;
      });
    } catch (galat) {
      console.warn("Gagal memuat katalog buku:", galat);
    } finally {
      sedangMuatBuku = false;
    }
  }

  function tampilkanDropdownBuku(kataKunci) {
    if (!listDropdownBuku) return;
    const q = String(kataKunci || "").trim().toLowerCase();

    if (sedangMuatBuku && semuaBukuDb.length === 0) {
      listDropdownBuku.innerHTML =
        '<div style="padding:10px 12px;font-size:13px;color:#64748b;">Memuat daftar buku...</div>';
      listDropdownBuku.style.display = "block";
      return;
    }

    const hasil = bukuTersediaDb.filter(function (b) {
      const judul = String(b.title || "").toLowerCase();
      const kode = String(b.code || "").toLowerCase();
      const penulis = String(b.author || "").toLowerCase();
      return !q || judul.includes(q) || kode.includes(q) || penulis.includes(q);
    });

    if (hasil.length === 0) {
      listDropdownBuku.innerHTML =
        '<div style="padding:10px 12px;font-size:13px;color:#64748b;">Tidak ada buku tersedia yang cocok.</div>';
    } else {
      listDropdownBuku.innerHTML = hasil.map(function (b) {
        return (
          '<div class="book-combo-item" data-code="' + esc(b.code) + '" data-title="' + esc(b.title) + '" ' +
            'style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;">' +
            '<div>' +
              '<div style="font-weight:600;color:#0f172a;">' + esc(b.title) +
                ' <span style="font-weight:400;color:#64748b;font-size:11px;">(' + esc(b.code) + ')</span></div>' +
              '<div style="font-size:11px;color:#64748b;">' + esc(b.author || "-") + '</div>' +
            '</div>' +
            '<span style="font-size:11px;font-weight:600;color:#1d4ed8;background:#eff6ff;padding:2px 8px;border-radius:999px;white-space:nowrap;">' +
              'Stok: ' + esc(b.available) +
            '</span>' +
          '</div>'
        );
      }).join("");
    }

    listDropdownBuku.style.display = "block";
  }

  function validasiInputBuku() {
    const teks = inputBuku.value.trim();
    const kodeTerpilih = inputBukuCode ? inputBukuCode.value.trim() : "";

    if (!teks) {
      setErrorField(inputBuku, errorBukuEl, "Judul buku wajib diisi dan dipilih dari daftar.");
      return null;
    }

    let cocok = null;
    if (kodeTerpilih) {
      cocok = semuaBukuDb.find(function (b) { return b.code === kodeTerpilih; }) || null;
    }

    if (!cocok) {
      const q = teks.toLowerCase();
      const daftarCocok = semuaBukuDb.filter(function (b) {
        return String(b.title || "").trim().toLowerCase() === q ||
               String(b.code || "").trim().toLowerCase() === q;
      });

      if (daftarCocok.length === 0) {
        setErrorField(inputBuku, errorBukuEl, "Buku tidak ditemukan di database. Silakan pilih buku dari daftar.");
        return null;
      }
      if (daftarCocok.length > 1) {
        setErrorField(inputBuku, errorBukuEl, "Ada lebih dari satu buku dengan judul sama. Silakan pilih langsung dari daftar.");
        return null;
      }
      cocok = daftarCocok[0];
    }

    if (Number(cocok.available || 0) <= 0) {
      setErrorField(inputBuku, errorBukuEl, 'Stok buku "' + cocok.title + '" sudah habis (0 tersedia).');
      return null;
    }

    if (inputBukuCode) inputBukuCode.value = cocok.code;
    setErrorField(inputBuku, errorBukuEl, "");
    return cocok;
  }

  if (inputBuku && listDropdownBuku) {
    inputBuku.addEventListener("focus", async function () {
      if (listDropdownPeminjam) listDropdownPeminjam.style.display = "none";
      if (semuaBukuDb.length === 0) await muatDaftarBuku();
      tampilkanDropdownBuku(inputBuku.value);
    });

    inputBuku.addEventListener("click", function () {
      if (listDropdownPeminjam) listDropdownPeminjam.style.display = "none";
      tampilkanDropdownBuku(inputBuku.value);
    });

    inputBuku.addEventListener("input", function () {
      if (inputBukuCode) inputBukuCode.value = "";
      setErrorField(inputBuku, errorBukuEl, "");
      tampilkanDropdownBuku(inputBuku.value);
    });

    listDropdownBuku.addEventListener("mousedown", function (e) {
      const item = e.target.closest(".book-combo-item");
      if (!item) return;
      inputBuku.value = item.dataset.title;
      if (inputBukuCode) inputBukuCode.value = item.dataset.code;
      setErrorField(inputBuku, errorBukuEl, "");
      listDropdownBuku.style.display = "none";
    });
  }

  document.addEventListener("click", function (e) {
    if (inputPeminjam && listDropdownPeminjam && !inputPeminjam.contains(e.target) && !listDropdownPeminjam.contains(e.target)) {
      listDropdownPeminjam.style.display = "none";
    }
    if (inputBuku && listDropdownBuku && !inputBuku.contains(e.target) && !listDropdownBuku.contains(e.target)) {
      listDropdownBuku.style.display = "none";
    }
  });

  // ---------------- jendela: tambah peminjaman ----------------
  function tutup(modal) {
    modal.classList.remove("show");
    if (listDropdownPeminjam) listDropdownPeminjam.style.display = "none";
    if (listDropdownBuku) listDropdownBuku.style.display = "none";
  }

  document.getElementById("openAddLoan").addEventListener("click", async function () {
    formTambah.reset();
    if (inputPeminjamCode) inputPeminjamCode.value = "";
    if (inputBukuCode) inputBukuCode.value = "";
    setErrorField(inputPeminjam, errorPeminjamEl, "");
    setErrorField(inputBuku, errorBukuEl, "");
    if (listDropdownPeminjam) listDropdownPeminjam.style.display = "none";
    if (listDropdownBuku) listDropdownBuku.style.display = "none";

    const hariIni = new Date();
    const tempo = new Date();
    tempo.setDate(tempo.getDate() + 14);

    const lPinjam = document.getElementById("lPinjam");
    lPinjam.value = keIso(hariIni);
    lPinjam.readOnly = true;
    document.getElementById("lTempo").value = keIso(tempo);
    document.getElementById("lStatus").value = "borrowed";
    document.getElementById("lStatus").disabled = true;
    document.getElementById("lKembali").disabled = true;
    modalTambah.classList.add("show");

    await Promise.all([muatDaftarAnggota(), muatDaftarBuku()]);
  });

  formTambah.addEventListener("submit", async function (e) {
    e.preventDefault();

    const anggotaValid = validasiInputPeminjam();
    if (!anggotaValid) {
      inputPeminjam.focus();
      toast(errorPeminjamEl.textContent, true);
      return;
    }

    const bukuValid = validasiInputBuku();
    if (!bukuValid) {
      inputBuku.focus();
      toast(errorBukuEl.textContent, true);
      return;
    }

    const tombol = formTambah.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      const data = await panggil("/api/admin/loans", kirimJson({
        member: anggotaValid.npm || anggotaValid.code,
        book: bukuValid.code,
        due_date: document.getElementById("lTempo").value
      }));
      tutup(modalTambah);
      toast("Peminjaman " + kodePN(data.loan.id) + " dicatat.");
      state.page = 1;
      simpanUrl();
      await muat();
      await muatDaftarBuku();
    } catch (galat) {
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  // ---------------- jendela: ubah jatuh tempo ----------------
  const modalUbah = document.getElementById("editLoanModal");
  const formUbah = document.getElementById("editLoanForm");
  let idDiubah = null;

  function kunci(id, nilai) {
    const el = document.getElementById(id);
    el.value = nilai;
    if (el.tagName === "SELECT") el.disabled = true; else el.readOnly = true;
  }

  function bukaUbah(p) {
    idDiubah = p.id;
    document.getElementById("editLoanSub").textContent = p.code + " \u2022 " + p.borrower.name;
    kunci("elId", p.code);
    kunci("elPeminjam", p.borrower.name);
    kunci("elBuku", p.title);
    kunci("elPinjam", keIso(parseTanggal(p.confirmed_at || p.borrowed_at)));
    kunci("elStatus", p.display_status === "overdue" ? "overdue" : "borrowed");
    document.getElementById("elKembali").value = "";
    document.getElementById("elKembali").disabled = true;

    const tempo = document.getElementById("elTempo");
    tempo.value = p.due_date ? p.due_date.slice(0, 10) : "";
    tempo.readOnly = false;
    modalUbah.classList.add("show");
  }

  formUbah.addEventListener("submit", async function (e) {
    e.preventDefault();
    const tombol = formUbah.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      await panggil("/api/loans/" + idDiubah + "/due-date",
        kirimJson({ due_date: document.getElementById("elTempo").value }));
      tutup(modalUbah);
      toast("Jatuh tempo diperbarui.");
      await muat();
    } catch (galat) {
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  // ---------------- jendela: pengingat WhatsApp terlambat ----------------
  let modalWa = document.getElementById("overdueWaLoanModal");
  if (!modalWa) {
    modalWa = document.createElement("div");
    modalWa.className = "modal-overlay";
    modalWa.id = "overdueWaLoanModal";
    modalWa.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="waLoanTitle" style="max-width:640px;">' +
        '<div class="modal-head">' +
          '<div class="modal-icon" style="background:#dcfce7;color:#15803d;"><i data-lucide="message-circle"></i></div>' +
          '<div class="modal-title">' +
            '<h2 id="waLoanTitle">Pengingat Peminjaman Terlambat</h2>' +
            '<p>Kirim pesan pengingat pengembalian langsung ke WhatsApp peminjam.</p>' +
          '</div>' +
          '<button type="button" class="modal-close" data-close aria-label="Tutup"><i data-lucide="x"></i></button>' +
        '</div>' +
        '<div class="modal-body" id="waLoanBody" style="max-height:60vh;overflow-y:auto;"></div>' +
        '<div class="modal-foot">' +
          '<button type="button" class="btn-outline" data-close>Tutup</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalWa);
    lucide.createIcons();
  }

  const btnOverdue = document.getElementById("btnReviewOverdueLoan");
  if (btnOverdue) {
    btnOverdue.addEventListener("click", async function (e) {
      e.preventDefault();
      const isiModal = document.getElementById("waLoanBody");
      isiModal.innerHTML = '<p class="muted" style="text-align:center;padding:24px 0;">Memuat data peminjaman terlambat...</p>';
      modalWa.classList.add("show");
      try {
        const data = await panggil("/api/admin/loans?status=overdue&page=1");
        const terlambat = data.loans || [];
        if (terlambat.length === 0) {
          isiModal.innerHTML = '<p class="muted" style="text-align:center;padding:24px 0;">Tidak ada peminjaman yang terlambat saat ini.</p>';
        } else {
          isiModal.innerHTML = terlambat.map(function (p) {
            const hp = p.borrower && p.borrower.phone ? p.borrower.phone : "";
            const link = buatLinkWa(p);
            const dTempo = parseTanggal(p.due_date);
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
                '<div style="font-size:12px;color:#dc2626;margin-top:2px;">Jatuh tempo: ' + esc(dTempo ? tglPanjang(dTempo) : p.due_date) + '</div>' +
              '</div>' +
              tombolWa +
            '</div>';
          }).join("");
          lucide.createIcons();
        }
      } catch (galat) {
        isiModal.innerHTML = '<p style="color:#dc2626;text-align:center;padding:24px 0;">Gagal memuat daftar peminjaman terlambat.</p>';
      }
    });
  }

  // ---------------- menutup jendela ----------------
  [modalTambah, modalUbah, modalWa].forEach(function (modal) {
    modal.querySelectorAll("[data-close]").forEach(function (t) {
      t.addEventListener("click", function () { tutup(modal); });
    });
    modal.addEventListener("click", function (e) { if (e.target === modal) tutup(modal); });
  });

  if (window._peminjamanEscKey) {
    document.removeEventListener("keydown", window._peminjamanEscKey);
  }
  window._peminjamanEscKey = function (e) {
    if (e.key !== "Escape") return;
    [modalTambah, modalUbah, modalWa].forEach(function (m) {
      if (document.body.contains(m)) tutup(m);
    });
  };
  document.addEventListener("keydown", window._peminjamanEscKey);

  // ---------------- mulai ----------------
  bacaUrl();
  muat();
  muatDaftarAnggota();
  muatDaftarBuku();
})();
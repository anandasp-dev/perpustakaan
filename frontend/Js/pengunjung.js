// PENGUNJUNG — halaman admin, tersambung ke database lewat /api/admin/visitors
lucide.createIcons();

(function () {
  "use strict";

  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const BULAN_PENUH = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const LABEL_TUJUAN = {
    "Meminjam buku": "Meminjam buku",
    "Login portal anggota": "Login portal web",
    "Login portal web": "Login portal web"
  };

  function dua(n) { return String(n).padStart(2, "0"); }
  function angka(n) { return Number(n || 0).toLocaleString("id-ID"); }
  function isi(el, teks) { if (el) el.textContent = teks; }

  function esc(teks) {
    return String(teks ?? "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function parseTanggal(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || ""));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function keIso(d) {
    return d.getFullYear() + "-" + dua(d.getMonth() + 1) + "-" + dua(d.getDate());
  }

  function tglPendek(d) {
    return dua(d.getDate()) + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }

  function tglPenuh(d) {
    return dua(d.getDate()) + " " + BULAN_PENUH[d.getMonth()] + " " + d.getFullYear();
  }

  function formatTujuan(raw) {
    if (!raw) return "";
    return LABEL_TUJUAN[raw] || raw;
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

  // ---------------- elemen halaman ----------------
  const badan = document.getElementById("visitorBody");
  const formFilter = document.querySelector('form[action="pengunjung.html"]') || document.querySelector("main form");
  const inputCari = formFilter.querySelector('input[name="q"]');
  const pager = document.querySelector(".table-foot .pager");
  const tombolSebelum = pager.querySelectorAll("button")[0];
  const tombolBerikut = pager.querySelectorAll("button")[1];
  const pilPager = pager.querySelector(".pill");

  const state = { q: "", page: 1 };
  let daftar = [];

  // ---------------- sinkron URL ----------------
  function bacaUrl() {
    const p = new URLSearchParams(window.location.search);
    state.q = p.get("q") || "";
    const hal = Number(p.get("hal"));
    state.page = hal > 0 ? hal : 1;
    inputCari.value = state.q;
  }

  function simpanUrl() {
    const p = new URLSearchParams(window.location.search);
    ["q", "tipe", "type", "hal"].forEach(function (k) { p.delete(k); });
    if (state.q) p.set("q", state.q);
    if (state.page > 1) p.set("hal", String(state.page));
    const qs = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }

  // ---------------- render tabel & kartu ----------------
  function barisHtml(v) {
    const dVisit = parseTanggal(v.visit_date);
    const tujuanTeks = formatTujuan(v.purpose);

    return (
      '<tr data-id="' + v.id + '">' +
        '<td class="muted">' + esc(v.code) + "</td>" +
        (v.member_ref ? '<td class="muted">' + esc(v.member_ref) + "</td>" : '<td class="dash">&mdash;</td>') +
        "<td><b>" + esc(v.name) + "</b></td>" +
        "<td>" + (dVisit ? tglPendek(dVisit) : esc(v.visit_date || "-")) + "</td>" +
        (tujuanTeks ? "<td>" + esc(tujuanTeks) + "</td>" : '<td class="dash">&mdash;</td>') +
        '<td><button type="button" class="icon-act icon-edit" aria-label="Ubah"><i data-lucide="pencil"></i></button></td>' +
      "</tr>"
    );
  }

  function nonaktifkanTombol(tombol, mati) {
    tombol.disabled = mati;
    tombol.style.opacity = mati ? "0.5" : "";
    tombol.style.cursor = mati ? "not-allowed" : "";
  }

  function gambarTabel(data) {
    const rows = data.visitors || [];
    badan.innerHTML = rows.length === 0
      ? '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px;">Tidak ada catatan kunjungan yang cocok.</td></tr>'
      : rows.map(barisHtml).join("");
    lucide.createIcons();

    const awal = rows.length ? (data.page - 1) * data.per_page + 1 : 0;
    const akhir = rows.length ? awal + rows.length - 1 : 0;
    const sekarang = new Date();

    isi(
      document.querySelector(".section-sub"),
      "Catatan kunjungan per " + tglPenuh(sekarang) + " \u2022 diurutkan berdasarkan kunjungan terbaru"
    );
    isi(
      document.querySelector(".table-foot > .muted"),
      "Menampilkan " + awal + "-" + akhir + " dari " + angka(data.total) +
      " catatan kunjungan \u2022 " + data.per_page + " per halaman"
    );
    isi(pilPager, data.page + " / " + data.pages);
    nonaktifkanTombol(tombolSebelum, data.page <= 1);
    nonaktifkanTombol(tombolBerikut, data.page >= data.pages);
  }

  function isiKartu(summary) {
    if (!summary) return;
    const kartu = document.querySelectorAll(".stats .stat");
    const dToday = parseTanggal(summary.today_date) || new Date();
    const dStart = parseTanggal(summary.week_start);

    if (kartu[0]) {
      isi(kartu[0].querySelector(".stat-number"), angka(summary.today));
      isi(kartu[0].querySelector(".stat-note"), tglPenuh(dToday));
    }
    if (kartu[1]) {
      isi(kartu[1].querySelector(".stat-number"), angka(summary.week));
      isi(
        kartu[1].querySelector(".stat-note"),
        dStart ? tglPendek(dStart) + " - " + tglPendek(dToday) : "7 hari terakhir"
      );
    }
    if (kartu[2]) {
      isi(kartu[2].querySelector(".stat-number"), angka(summary.month));
      isi(kartu[2].querySelector(".stat-note"), BULAN_PENUH[dToday.getMonth()] + " " + dToday.getFullYear());
    }
  }

  // ---------------- ambil data pengunjung ----------------
  async function muat() {
    const params = new URLSearchParams({ page: String(state.page) });
    if (state.q) params.set("q", state.q);

    try {
      const data = await panggil("/api/admin/visitors?" + params.toString());
      if (data.page > data.pages) {
        state.page = data.pages;
        simpanUrl();
        return muat();
      }
      daftar = data.visitors || [];
      gambarTabel(data);
      isiKartu(data.summary);
    } catch (galat) {
      if (galat.status === 403) {
        window.location.href = "/Pages/dashboard";
        return;
      }
      console.warn("Gagal memuat pengunjung:", galat);
      toast("Gagal memuat data pengunjung dari server.", true);
    }
  }

  // ---------------- pencarian & paginasi ----------------
  formFilter.addEventListener("submit", function (e) {
    e.preventDefault();
    state.q = inputCari.value.trim();
    state.page = 1;
    simpanUrl();
    muat();
  });

  tombolSebelum.addEventListener("click", function () {
    if (state.page > 1) {
      state.page--;
      simpanUrl();
      muat();
    }
  });

  tombolBerikut.addEventListener("click", function () {
    if (!tombolBerikut.disabled) {
      state.page++;
      simpanUrl();
      muat();
    }
  });

  // ---------------- autocomplete anggota dari database ----------------
  let semuaAnggotaDb = [];
  let sedangMuatAnggota = false;

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
    } catch (galat) {
      console.warn("Gagal memuat daftar anggota:", galat);
    } finally {
      sedangMuatAnggota = false;
    }
  }

  function setupMemberPicker(inputEl, codeEl, dropdownEl, errorEl) {
    function setErr(msg) {
      if (msg) {
        errorEl.textContent = msg;
        errorEl.style.display = "block";
        inputEl.style.borderColor = "#dc2626";
      } else {
        errorEl.textContent = "";
        errorEl.style.display = "none";
        inputEl.style.borderColor = "";
      }
    }

    function renderList(keyword) {
      const q = String(keyword || "").trim().toLowerCase();
      if (sedangMuatAnggota && semuaAnggotaDb.length === 0) {
        dropdownEl.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:#64748b;">Memuat daftar anggota...</div>';
        dropdownEl.style.display = "block";
        return;
      }

      const hasil = semuaAnggotaDb.filter(function (m) {
        const nama = String(m.name || "").toLowerCase();
        const npm = String(m.npm || "").toLowerCase();
        const kode = String(m.code || "").toLowerCase();
        return !q || nama.includes(q) || npm.includes(q) || kode.includes(q);
      });

      if (hasil.length === 0) {
        dropdownEl.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:#64748b;">Anggota tidak ditemukan.</div>';
      } else {
        dropdownEl.innerHTML = hasil.map(function (m) {
          const label = m.name + (m.npm ? " (" + m.npm + ")" : " (" + m.code + ")");
          return (
            '<div class="visitor-member-item" data-code="' + esc(m.code) + '" data-label="' + esc(label) + '" ' +
              'style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;">' +
              '<div>' +
                '<div style="font-weight:600;color:#0f172a;">' + esc(m.name) + '</div>' +
                '<div style="font-size:11px;color:#64748b;">NPM: ' + esc(m.npm || "-") + '</div>' +
              '</div>' +
              '<span style="font-size:11px;font-weight:600;color:#0f766e;background:#f0fdfa;padding:2px 8px;border-radius:999px;">' +
                esc(m.code) +
              '</span>' +
            '</div>'
          );
        }).join("");
      }
      dropdownEl.style.display = "block";
    }

    inputEl.addEventListener("focus", async function () {
      if (semuaAnggotaDb.length === 0) await muatDaftarAnggota();
      renderList(inputEl.value);
    });

    inputEl.addEventListener("click", function () {
      renderList(inputEl.value);
    });

    inputEl.addEventListener("input", function () {
      codeEl.value = "";
      setErr("");
      renderList(inputEl.value);
    });

    dropdownEl.addEventListener("mousedown", function (e) {
      const item = e.target.closest(".visitor-member-item");
      if (!item) return;
      inputEl.value = item.dataset.label;
      codeEl.value = item.dataset.code;
      setErr("");
      dropdownEl.style.display = "none";
    });

    document.addEventListener("click", function (e) {
      if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
        dropdownEl.style.display = "none";
      }
    });

    return {
      setErr: setErr,
      validate: function () {
        const teks = inputEl.value.trim();
        const kode = codeEl.value.trim();
        if (!teks) {
          setErr("Anggota wajib dipilih dari daftar.");
          return null;
        }
        let cocok = kode
          ? (semuaAnggotaDb.find(function (m) { return m.code === kode; }) || null)
          : null;

        if (!cocok) {
          const q = teks.toLowerCase();
          const list = semuaAnggotaDb.filter(function (m) {
            const label = (m.name + (m.npm ? " (" + m.npm + ")" : " (" + m.code + ")")).toLowerCase();
            return String(m.npm || "").toLowerCase() === q ||
                   String(m.code || "").toLowerCase() === q ||
                   String(m.name || "").toLowerCase() === q ||
                   label === q;
          });
          if (list.length === 0) {
            setErr("Anggota tidak ditemukan di database. Silakan pilih dari daftar.");
            return null;
          }
          if (list.length > 1) {
            setErr("Ada lebih dari satu anggota yang cocok. Pilih langsung dari daftar.");
            return null;
          }
          cocok = list[0];
        }

        codeEl.value = cocok.code;
        setErr("");
        return cocok;
      }
    };
  }

  // ---------------- modal tambah pengunjung ----------------
  const modal = document.getElementById("visitorModal");
  const form = document.getElementById("visitorForm");
  const vAnggota = document.getElementById("vAnggota");
  const vAnggotaCode = document.getElementById("vAnggotaCode");
  const vDropdown = document.getElementById("vMemberDropdown");
  const vError = document.getElementById("vAnggotaError");
  const vTujuan = document.getElementById("vTujuan");

  const pickerTambah = setupMemberPicker(vAnggota, vAnggotaCode, vDropdown, vError);

  function tutupTambah() {
    modal.classList.remove("show");
    vDropdown.style.display = "none";
  }

  document.getElementById("openAddVisitor").addEventListener("click", async function () {
    form.reset();
    vAnggotaCode.value = "";
    pickerTambah.setErr("");
    document.getElementById("vTanggal").value = keIso(new Date());
    vTujuan.value = "Meminjam buku";
    modal.classList.add("show");
    await muatDaftarAnggota();
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const anggotaValid = pickerTambah.validate();
    if (!anggotaValid) {
      vAnggota.focus();
      toast(vError.textContent, true);
      return;
    }

    const tombol = form.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      const res = await panggil("/api/admin/visitors", kirimJson({
        member: anggotaValid.npm || anggotaValid.code,
        visit_date: document.getElementById("vTanggal").value,
        purpose: vTujuan.value
      }));
      tutupTambah();
      toast("Kunjungan " + res.code + " berhasil dicatat.");
      state.page = 1;
      simpanUrl();
      await muat();
    } catch (galat) {
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  // ---------------- modal ubah pengunjung ----------------
  const editModal = document.getElementById("editVisitorModal");
  const editForm = document.getElementById("editVisitorForm");
  const evAnggota = document.getElementById("evAnggota");
  const evAnggotaCode = document.getElementById("evAnggotaCode");
  const evDropdown = document.getElementById("evMemberDropdown");
  const evError = document.getElementById("evAnggotaError");
  const evTujuan = document.getElementById("evTujuan");
  let idDiubah = null;

  const pickerUbah = setupMemberPicker(evAnggota, evAnggotaCode, evDropdown, evError);

  function tutupUbah() {
    editModal.classList.remove("show");
    evDropdown.style.display = "none";
  }

  badan.addEventListener("click", async function (e) {
    const tombol = e.target.closest(".icon-edit");
    if (!tombol) return;

    const tr = tombol.closest("tr");
    const v = daftar.find(function (item) { return item.id === Number(tr.dataset.id); });
    if (!v) return;

    idDiubah = v.id;
    pickerUbah.setErr("");
    document.getElementById("evId").value = v.code;
    document.getElementById("editVisitorSub").textContent = v.code + " \u2022 " + v.name;
    evAnggota.value = v.name + (v.npm ? " (" + v.npm + ")" : (v.member_code ? " (" + v.member_code + ")" : ""));
    evAnggotaCode.value = v.member_code || "";
    document.getElementById("evTanggal").value = v.visit_date || "";
    evTujuan.value = (v.purpose === "Login portal anggota" || v.purpose === "Login portal web")
      ? "Login portal anggota"
      : "Meminjam buku";

    editModal.classList.add("show");
    if (semuaAnggotaDb.length === 0) await muatDaftarAnggota();
  });

  editForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const anggotaValid = pickerUbah.validate();
    if (!anggotaValid) {
      evAnggota.focus();
      toast(evError.textContent, true);
      return;
    }

    const tombol = editForm.querySelector('button[type="submit"]');
    tombol.disabled = true;
    try {
      await panggil("/api/admin/visitors/" + idDiubah, kirimJson({
        member: anggotaValid.npm || anggotaValid.code,
        visit_date: document.getElementById("evTanggal").value,
        purpose: evTujuan.value
      }));
      tutupUbah();
      toast("Data pengunjung berhasil diperbarui.");
      await muat();
    } catch (galat) {
      toast(galat.message, true);
    } finally {
      tombol.disabled = false;
    }
  });

  // ---------------- penutup modal ----------------
  modal.querySelectorAll("[data-close]").forEach(function (t) {
    t.addEventListener("click", tutupTambah);
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) tutupTambah();
  });

  editModal.querySelectorAll("[data-close]").forEach(function (t) {
    t.addEventListener("click", tutupUbah);
  });
  editModal.addEventListener("click", function (e) {
    if (e.target === editModal) tutupUbah();
  });

  if (window._pengunjungEscKey) {
    document.removeEventListener("keydown", window._pengunjungEscKey);
  }
  window._pengunjungEscKey = function (e) {
    if (e.key === "Escape") {
      tutupTambah();
      tutupUbah();
    }
  };
  document.addEventListener("keydown", window._pengunjungEscKey);

  // ---------------- mulai ----------------
  bacaUrl();
  muat();
  muatDaftarAnggota();
})();